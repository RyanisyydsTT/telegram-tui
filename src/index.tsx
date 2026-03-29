import React, { useState, useEffect, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { TelegramManager } from './telegram.js';
import pkgGenerate from '@asharahmed/qr-cli/dist/generate.js';
const { generateQRMatrix } = pkgGenerate;
import pkgRender from '@asharahmed/qr-cli/dist/render.js';
const { renderQRCode } = pkgRender;
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';

// Switch to alternate screen and explicitly DISABLE all mouse tracking to prevent artifacts
process.stdout.write('\x1b[?1049h\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l');

const telegram = new TelegramManager();

const App = () => {
    const { exit } = useApp();
    const [status, setStatus] = useState<'connecting' | 'login' | 'main'>('connecting');
    const [activePane, setActivePane] = useState<'sidebar' | 'chat' | 'search'>('sidebar');
    const [sidebarMode, setSidebarMode] = useState<'chats' | 'topics'>('chats');
    
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [chats, setChats] = useState<any[]>([]);
    const [topics, setTopics] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChat, setSelectedChat] = useState<any>(null);
    const [selectedTopic, setSelectedTopic] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [msgScrollOffset, setMsgScrollOffset] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [input, setInput] = useState('');
    const [exitConfirm, setExitConfirm] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    const [dimensions, setDimensions] = useState({ 
        columns: process.stdout.columns || 80, 
        rows: process.stdout.rows || 24 
    });

    useEffect(() => {
        const onResize = () => setDimensions({ columns: process.stdout.columns, rows: process.stdout.rows });
        process.stdout.on('resize', onResize);
        const init = async () => {
            try {
                await telegram.connect();
                if (await telegram.isAuthorized()) {
                    loadChats();
                } else {
                    startLoginFlow();
                }
            } catch (e) { handleExit(); }
        };
        init();
        return () => {
            process.stdout.off('resize', onResize);
            process.stdout.write('\x1b[?1049l');
        };
    }, []);

    const handleExit = () => {
        process.stdout.write('\x1b[?1049l');
        exit();
    };

    const startLoginFlow = async () => {
        setStatus('login');
        const link = await telegram.getQRLink();
        if (link) {
            const matrix = await generateQRMatrix(link);
            const qr = renderQRCode(matrix, { small: true });
            setQrCode(qr);
            telegram.waitForLogin().then(() => loadChats());
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        setStatus('connecting');
        await telegram.logout();
        
        // Reset App State
        setChats([]);
        setTopics([]);
        setMessages([]);
        setSearchQuery('');
        setSelectedChat(null);
        setSelectedTopic(null);
        setSidebarMode('chats');
        setActivePane('sidebar');
        setIsLoggingOut(false);
        
        await startLoginFlow();
    };

    const loadChats = async () => {
        const chatList = await telegram.getChats();
        setChats(chatList.map(c => ({ 
            label: c.name + (c.isForum ? " [F]" : ""), 
            value: c.id,
            isForum: c.isForum,
            canSend: c.canSend,
            originalName: c.name
        })));
        setStatus('main');
    };

    const loadTopics = async (chatId: any) => {
        const topicList = await telegram.getForumTopics(chatId);
        setTopics([
            { label: "<- Back to Chats", value: "back" },
            ...topicList.map((t: any) => ({ label: "# " + t.name, value: t.id }))
        ]);
        setSidebarMode('topics');
    };

    const loadMessages = async (chatId: any, topicId?: number, clear = true) => {
        if (isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const lastId = !clear && messages.length > 0 ? messages[0].id : undefined;
            const msgList = await telegram.getMessages(chatId, topicId, 50, lastId);
            
            if (msgList.length === 0) {
                setHasMoreMessages(false);
            } else {
                const reversed = [...msgList].reverse();
                if (clear) {
                    setMessages(reversed);
                    setMsgScrollOffset(0);
                    setHasMoreMessages(true);
                } else {
                    setMessages(prev => [...reversed, ...prev]);
                }
            }
        } finally {
            setIsLoadingMore(false);
        }
    }

    const handleChatSelect = async (item: any) => {
        if (!item) return;
        if (item.isForum) {
            setSelectedChat(item);
            await loadTopics(item.value);
            setActivePane('sidebar');
            setSearchQuery('');
        } else {
            setSelectedChat(item);
            setSelectedTopic(null);
            await loadMessages(item.value);
            setActivePane('chat');
        }
    };

    const handleTopicSelect = async (item: any) => {
        if (!item) return;
        if (item.value === 'back') {
            setSidebarMode('chats');
            setSelectedTopic(null);
            setSearchQuery('');
            setActivePane('sidebar');
        } else {
            setSelectedTopic(item);
            await loadMessages(selectedChat.value, item.value);
            setActivePane('chat');
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || !selectedChat || !selectedChat.canSend) return;
        const msg = input;
        setInput('');
        await telegram.sendMessage(selectedChat.value, msg, selectedTopic?.value);
        loadMessages(selectedChat.value, selectedTopic?.value, true);
    };

    useInput((inputStr, key) => {
        if (key.ctrl && inputStr === 'l') {
            handleLogout();
            return;
        }

        if (exitConfirm) {
            if (key.escape) handleExit();
            else setExitConfirm(false);
            return;
        }

        if (key.escape) {
            if (activePane === 'search') {
                setActivePane('sidebar');
                setSearchQuery('');
            } else if (activePane === 'chat') {
                setActivePane('sidebar');
            } else if (sidebarMode === 'topics' && !selectedTopic) {
                setSidebarMode('chats');
            } else {
                setExitConfirm(true);
            }
            return;
        }

        if (key.tab) {
            if (activePane === 'search') setActivePane('sidebar');
            else setActivePane(prev => prev === 'sidebar' ? 'chat' : 'sidebar');
            return;
        }

        if (activePane === 'sidebar' && status === 'main') {
            if (inputStr === '/' || (inputStr && /[a-zA-Z0-9]/.test(inputStr) && !key.ctrl && !key.meta && !key.return)) {
                if (inputStr !== '/') setSearchQuery(inputStr);
                setActivePane('search');
                return;
            }
        }

        if (activePane === 'chat' && status === 'main') {
            const maxOffset = Math.max(0, messages.length - 10);
            if (key.pageUp || (key.shift && key.upArrow)) {
                const newOffset = Math.min(maxOffset, msgScrollOffset + 5);
                setMsgScrollOffset(newOffset);
                if (newOffset >= maxOffset - 5 && hasMoreMessages && !isLoadingMore) {
                    loadMessages(selectedChat.value, selectedTopic?.value, false);
                }
            } else if (key.pageDown || (key.shift && key.downArrow)) {
                setMsgScrollOffset(prev => Math.max(0, prev - 5));
            }
        }
    });

    const filteredChats = useMemo(() => chats.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase())), [chats, searchQuery]);
    const filteredTopics = useMemo(() => topics.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase())), [topics, searchQuery]);
    const currentList = sidebarMode === 'chats' ? filteredChats : filteredTopics;

    const visibleMessages = useMemo(() => {
        const end = messages.length - msgScrollOffset;
        const start = Math.max(0, end - (dimensions.rows - 10));
        return messages.slice(start, end);
    }, [messages, msgScrollOffset, dimensions.rows]);

    if (status === 'connecting') return (
        <Box padding={1} height={dimensions.rows} alignItems="center" justifyContent="center">
            <Text color="blue">
                <Spinner type="dots" />
                {isLoggingOut ? " Logging out and clearing session..." : " Initializing Telegram..."}
            </Text>
        </Box>
    );

    if (status === 'login') return (
        <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center" height={dimensions.rows}>
            <Text bold color="cyan">Telegram Login</Text>
            <Box borderStyle="single" padding={1} marginTop={1}>{qrCode ? <Text>{qrCode}</Text> : <Spinner type="dots" />}</Box>
            <Box marginTop={1}>
                <Text color="yellow">Scan QR with Telegram app</Text>
            </Box>
            <Box marginTop={1}>
                <Text color="gray">Esc to exit</Text>
            </Box>
        </Box>
    );

    return (
        <Box flexDirection="column" height={dimensions.rows} width={dimensions.columns}>
            <Box paddingX={1} borderStyle="single" borderColor="cyan" justifyContent="space-between" height={3} flexShrink={0}>
                <Text bold color="cyan">TG-TUI v1.8</Text>
                {exitConfirm ? <Text color="red" bold>Confirm Exit? (Esc: Yes | Any Key: No)</Text> : <Text color="gray">Tab: Switch | /: Search | Ctrl+L: Logout | Esc: Back</Text>}
            </Box>

            <Box flexDirection="row" flexGrow={1} overflowY="hidden">
                <Box flexDirection="column" width={30} flexShrink={0} borderStyle="single" borderColor={activePane !== 'chat' ? 'green' : 'gray'} paddingX={1}>
                    <Text bold color={activePane !== 'chat' ? 'green' : 'white'}>
                        {sidebarMode === 'chats' ? "CHATS" : "TOPICS"}{activePane === 'sidebar' ? " ●" : (activePane === 'search' ? " 🔍" : "")}
                    </Text>
                    
                    <Box height={3} borderStyle="round" borderColor={activePane === 'search' ? 'yellow' : 'gray'} paddingX={1} marginTop={1} marginBottom={1}>
                        <Text color="yellow">🔍 </Text>
                        <TextInput 
                            value={searchQuery} 
                            onChange={setSearchQuery} 
                            focus={activePane === 'search'}
                            onSubmit={() => setActivePane('sidebar')}
                        />
                    </Box>

                    <Box flexGrow={1} overflowY="hidden">
                        {currentList.length > 0 ? (
                            <SelectInput 
                                items={currentList} 
                                onSelect={sidebarMode === 'chats' ? handleChatSelect : handleTopicSelect} 
                                isFocused={activePane === 'sidebar'}
                                limit={dimensions.rows - 12}
                            />
                        ) : (
                            <Text color="gray italic">No results</Text>
                        )}
                    </Box>
                </Box>

                <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={activePane === 'chat' ? 'green' : 'gray'} paddingX={1}>
                    {selectedChat && (sidebarMode === 'chats' || (sidebarMode === 'topics' && selectedTopic)) ? (
                        <>
                            <Box justifyContent="space-between" borderStyle="bold" borderBottom={true} height={1} flexShrink={0}>
                                <Box>
                                    <Text bold color={activePane === 'chat' ? 'green' : 'white'}>
                                        {selectedTopic ? selectedTopic.label : selectedChat.originalName}
                                        {activePane === 'chat' ? " ●" : ""}
                                    </Text>
                                    {isLoadingMore && <Text color="yellow"> {"["}Loading history...{"]"}</Text>}
                                </Box>
                                <Text color="gray">{messages.length} msgs</Text>
                            </Box>
                            
                            <Box flexDirection="column" flexGrow={1} marginTop={1} overflowY="hidden">
                                {!hasMoreMessages && (
                                    <Box alignSelf="center">
                                        <Text color="gray italic">--- Beginning of History ---</Text>
                                    </Box>
                                )}
                                {visibleMessages.length > 0 ? visibleMessages.map((m, i) => (
                                    <Box key={i}>
                                        <Text textWrap="truncate-end">
                                            <Text color="gray">[{new Date(m.date * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] </Text>
                                            <Text bold color="blue">{m.sender === 'System' ? 'S' : 'U'}: </Text>
                                            <Text>{m.text}</Text>
                                        </Text>
                                    </Box>
                                )) : <Box flexGrow={1} alignItems="center" justifyContent="center"><Text color="gray">No messages</Text></Box>}
                            </Box>
                            
                            <Box borderStyle="round" paddingX={1} borderColor={selectedChat.canSend ? (activePane === 'chat' ? 'blue' : 'gray') : 'red'} flexShrink={0}>
                                {selectedChat.canSend ? (
                                    <TextInput value={input} onChange={setInput} onSubmit={handleSendMessage} focus={activePane === 'chat'} placeholder="Type message..." />
                                ) : (
                                    <Text color="red">Read-only Permissions</Text>
                                )}
                            </Box>
                        </>
                    ) : (
                        <Box flexGrow={1} alignItems="center" justifyContent="center"><Text color="gray italic">Select a conversation</Text></Box>
                    )}
                </Box>
            </Box>

            <Box paddingX={1} backgroundColor="blue" height={1} flexShrink={0} justifyContent="space-between">
                <Text color="white">CONNECTED | {selectedChat ? (selectedTopic ? `${selectedChat.originalName} > ${selectedTopic.label}` : selectedChat.originalName) : "IDLE"}</Text>
                <Text color="white">SEARCH: {searchQuery || "None"} | HISTORY: {messages.length}</Text>
            </Box>
        </Box>
    );
};

render(<App />);
