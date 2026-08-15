import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Smile, Info, ShieldAlert, Sparkles, LogIn, Hash, Settings, Camera, User, Loader2, CornerUpLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Message {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  avatarBgColor?: string;
  content: string;
  createdAt: string;
  localReceivedAt?: number;
  reactions?: { [emoji: string]: string[] };
  reactionsLocalUpdate?: number;
  replyTo?: {
    id: string;
    username: string;
    content: string;
  } | null;
}

interface ChatModalProps {
  user: any; // User | null
  onClose: () => void;
  soundEnabled?: boolean;
}

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👏', '😍', '👍', '😢', '🙌'];

const BG_COLOR_PRESETS = [
  '#E0E7FF', // Indigo
  '#FEE2E2', // Red
  '#FEF3C7', // Amber
  '#D1FAE5', // Emerald
  '#EDE9FE', // Violet
  '#FFE4E6', // Rose
  '#E0F2FE', // Sky
  '#F3F4F6', // Gray
  '#FFEDD5', // Orange
  '#F0FDF4', // Light Green
];

export default function ChatModal({ user, onClose, soundEnabled = true }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('chat_guest_name') || '';
  });
  const [tempNameInput, setTempNameInput] = useState('');
  const [isSettingName, setIsSettingName] = useState(!user && !guestName);
  const [activeUsersCount, setActiveUsersCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Typing indicator states and refs
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; avatarUrl: string; avatarBgColor?: string }>>({});
  const isTypingLocalRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<any>(null);
  const remoteTypingTimeoutsRef = useRef<Record<string, any>>({});
  const lastTypingBroadcastTimeRef = useRef<number>(0);

  // Determine current user identity
  const currentUserId = user?.id || (guestName ? `guest_${guestName}` : 'guest_temporary');

  const [customUsername, setCustomUsername] = useState(() => {
    return localStorage.getItem(`chat_custom_username_${currentUserId}`) || '';
  });
  const [customAvatarUrl, setCustomAvatarUrl] = useState(() => {
    return localStorage.getItem(`chat_custom_avatar_${currentUserId}`) || '';
  });
  const [customAvatarBgColor, setCustomAvatarBgColor] = useState(() => {
    return localStorage.getItem(`chat_custom_bg_${currentUserId}`) || '#E0E7FF';
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem(`chat_is_admin_${currentUserId}`) === 'true';
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [supabaseTablesMissing, setSupabaseTablesMissing] = useState(false);
  const [showSqlSetup, setShowSqlSetup] = useState(false);

  const [avatarTemplates, setAvatarTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateUrl, setNewTemplateUrl] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const isInitialScrollRef = useRef(true);
  const [settingsNameInput, setSettingsNameInput] = useState('');
  const [settingsBgColor, setSettingsBgColor] = useState('#E0E7FF');
  const [settingsAvatarInput, setSettingsAvatarInput] = useState('');

  const currentUsername = customUsername || user?.user_metadata?.full_name || user?.email?.split('@')[0] || guestName || 'زائر';
  const rawDefaultAvatar = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUsername)}&background=0369a1&color=fff&bold=true`;
  const currentUserAvatar = customAvatarUrl || rawDefaultAvatar;
  const currentUserBgColor = customAvatarBgColor || '#E0E7FF';

  // Sync states if guestName or user changes
  useEffect(() => {
    if (currentUserId && currentUserId !== 'guest_temporary') {
      const storedName = localStorage.getItem(`chat_custom_username_${currentUserId}`);
      const storedAvatar = localStorage.getItem(`chat_custom_avatar_${currentUserId}`);
      const storedBg = localStorage.getItem(`chat_custom_bg_${currentUserId}`);
      if (storedName) {
        setCustomUsername(storedName);
      } else {
        setCustomUsername('');
      }
      if (storedAvatar) {
        setCustomAvatarUrl(storedAvatar);
      } else {
        setCustomAvatarUrl('');
      }
      if (storedBg) {
        setCustomAvatarBgColor(storedBg);
      } else {
        setCustomAvatarBgColor('#E0E7FF');
      }
    }
  }, [currentUserId]);

  const fetchAvatarTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // 1. Try Supabase
      const { data, error } = await supabase
        .from('chat_avatars')
        .select('*')
        .order('name', { ascending: true });
      
      if (!error && data) {
        setAvatarTemplates(data);
        setLoadingTemplates(false);
        return;
      }
      
      if (error) {
        console.warn('Supabase fetchAvatarTemplates error (might be missing tables):', error.message);
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('does not exist'))) {
          setSupabaseTablesMissing(true);
        }
      }
    } catch (err) {
      console.warn('Supabase fetchAvatarTemplates failed:', err);
    }

    // 2. Fallback to API
    try {
      const res = await fetch(`/api/avatars?t=${Date.now()}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setAvatarTemplates(data);
        } else {
          console.warn('Fallback avatars API did not return application/json');
        }
      }
    } catch (e) {
      console.error('Error fetching avatar templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchAvatarTemplates();
  }, []);

  useEffect(() => {
    if (showSettings) {
      setSettingsNameInput(currentUsername);
      setSettingsBgColor(currentUserBgColor);
      setSettingsAvatarInput(currentUserAvatar);
    }
  }, [showSettings, currentUsername, currentUserAvatar, currentUserBgColor]);

  // Load cached messages from localStorage
  const loadLocalCache = (): Message[] => {
    try {
      const cached = localStorage.getItem('chat_history_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  };

  // Save messages to the local cache
  const saveToLocalCache = (msgs: Message[]) => {
    try {
      localStorage.setItem('chat_history_cache', JSON.stringify(msgs.slice(-100)));
    } catch (e) {
      console.error('Error saving to chat cache', e);
    }
  };

  // Fetch initial chat history
  const fetchHistory = async (isSilent = false) => {
    let supabaseSuccess = false;
    let data: Message[] = [];

    try {
      // 1. Try Supabase
      const { data: sbData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('createdAt', { ascending: true })
        .limit(200);

      if (!error && sbData) {
        data = sbData;
        supabaseSuccess = true;
      } else if (error) {
        console.warn('Supabase fetchHistory error (might be missing tables):', error.message);
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('does not exist'))) {
          setSupabaseTablesMissing(true);
        }
      }
    } catch (err) {
      console.warn('Supabase fetchHistory failed:', err);
    }

    if (!supabaseSuccess) {
      // 2. Fallback to API
      try {
        const response = await fetch(`/api/chat?t=${Date.now()}`);
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            throw new Error('API did not return application/json content');
          }
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
        // Fallback to local cache on network error
        setMessages(prev => {
          if (prev.length === 0) {
            const cached = loadLocalCache();
            if (cached.length > 0) {
              setTimeout(scrollToBottom, 100);
              return cached;
            }
          }
          return prev;
        });
        if (!isSilent) {
          setLoading(false);
          setTimeout(scrollToBottom, 100);
        }
        return;
      }
    }

    setMessages(prev => {
      // لمنع تداخل الرسائل واختفائها المؤقت نتيجة التأخر في كتابتها في قاعدة البيانات مقارنة بالبث الفوري،
      // نقوم بالاحتفاظ بالرسائل الأخيرة المستلمة أو المرسلة محلياً إذا لم تكن موجودة بعد في استعلام الخادم الجديد.
      const serverIds = new Set(data.map(m => m.id));
      const now = Date.now();
      
      const recentlyAdded = prev.filter(m => {
        if (serverIds.has(m.id)) return false;
        const msgTime = m.localReceivedAt || new Date(m.createdAt).getTime();
        // الاحتفاظ بالرسائل التي لم يمر عليها أكثر من 30 ثانية لتجنب اختفائها بسبب تأخر الحفظ أو تباين الساعات
        return (now - msgTime) < 30000;
      });

      // لمنع اختفاء التفاعلات مؤقتاً أثناء التحديث التلقائي (polling) قبل اكتمال الكتابة في قاعدة البيانات،
      // نقوم بالاحتفاظ بالتفاعلات المحلية المحدثة خلال آخر 8 ثوانٍ.
      const prevMap = new Map<string, Message>(prev.map(m => [m.id, m]));
      let combined = data.map(serverMsg => {
        const prevMsg = prevMap.get(serverMsg.id);
        if (prevMsg && prevMsg.reactionsLocalUpdate && (now - prevMsg.reactionsLocalUpdate) < 8000) {
          return {
            ...serverMsg,
            reactions: prevMsg.reactions,
            reactionsLocalUpdate: prevMsg.reactionsLocalUpdate
          };
        }
        return serverMsg;
      });

      if (recentlyAdded.length > 0) {
        combined = [...combined, ...recentlyAdded];
        combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      // If data is identical, don't trigger state update
      if (JSON.stringify(prev) === JSON.stringify(combined)) {
        return prev;
      }
      
      // Check if there are indeed new messages
      const hasNewMessages = combined.length > prev.length;
      const lastMessageIsMe = combined.length > 0 && combined[combined.length - 1].userId === currentUserId;
      
      if (hasNewMessages || lastMessageIsMe) {
        setTimeout(scrollToBottom, 100);
      }
      
      saveToLocalCache(combined);
      return combined;
    });

    if (!isSilent) {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    fetchHistory(false);

    // Setup a 3-second polling fallback for reliability in all environments (including iframes)
    const pollInterval = setInterval(() => {
      fetchHistory(true);
    }, 3000);

    // Setup Supabase Realtime channel for broadcasting
    const channel = supabase.channel('global_chat_room', {
      config: {
        broadcast: { self: false },
        presence: { key: currentUserId }
      }
    });

    channelRef.current = channel;

    // Listen to broadcasts from other users
    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        setMessages(prev => {
          // Check for duplicate to guarantee idempotency
          if (prev.some(m => m.id === payload.id)) return prev;
          setTimeout(scrollToBottom, 100);
          const messageWithTime = { ...payload, localReceivedAt: Date.now() };
          const updated = [...prev, messageWithTime];
          saveToLocalCache(updated);
          return updated;
        });
      })
      .on('broadcast', { event: 'message_reaction' }, ({ payload }) => {
        const { messageId, reactions } = payload;
        setMessages(prev => {
          const updated = prev.map(m => {
            if (m.id === messageId) {
              return { ...m, reactions, reactionsLocalUpdate: Date.now() };
            }
            return m;
          });
          saveToLocalCache(updated);
          return updated;
        });
      })
      .on('broadcast', { event: 'clear_chat' }, () => {
        setMessages([]);
        saveToLocalCache([]);
      })
      .on('broadcast', { event: 'user_typing' }, ({ payload }) => {
        const { userId, username, avatarUrl, avatarBgColor, isTyping } = payload;
        if (userId === currentUserId) return;

        setTypingUsers(prev => {
          const next = { ...prev };
          if (isTyping) {
            next[userId] = { username, avatarUrl, avatarBgColor };
            if (remoteTypingTimeoutsRef.current[userId]) {
              clearTimeout(remoteTypingTimeoutsRef.current[userId]);
            }
            remoteTypingTimeoutsRef.current[userId] = setTimeout(() => {
              setTypingUsers(current => {
                const updated = { ...current };
                delete updated[userId];
                return updated;
              });
            }, 4000);
          } else {
            delete next[userId];
            if (remoteTypingTimeoutsRef.current[userId]) {
              clearTimeout(remoteTypingTimeoutsRef.current[userId]);
              delete remoteTypingTimeoutsRef.current[userId];
            }
          }
          return next;
        });
      })
      // Track Presence (active users)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setActiveUsersCount(Object.keys(state).length || 1);
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState();
        setActiveUsersCount(Object.keys(state).length || 1);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState();
        setActiveUsersCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({
            username: currentUsername,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      // Clear all typing timeouts
      Object.values(remoteTypingTimeoutsRef.current).forEach(t => clearTimeout(t as any));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current as any);
    };
  }, [currentUserId, currentUsername, currentUserAvatar, currentUserBgColor]);

  const scrollToBottom = (forceBehavior?: ScrollBehavior) => {
    const container = scrollContainerRef.current;
    const isInitial = isInitialScrollRef.current;
    const behavior = forceBehavior || (isInitial ? 'auto' : 'smooth');
    
    if (container) {
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    
    if (isInitial) {
      isInitialScrollRef.current = false;
    }
  };

  useEffect(() => {
    if (!loading && messages.length > 0) {
      if (isInitialScrollRef.current) {
        scrollToBottom('auto');
      } else {
        scrollToBottom();
      }
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (Object.keys(typingUsers).length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [typingUsers]);

  // Handle local typing broadcasting
  const handleLocalTyping = (text: string) => {
    setInputMessage(text);

    if (!channelRef.current) return;

    if (!text.trim()) {
      if (isTypingLocalRef.current) {
        isTypingLocalRef.current = false;
        channelRef.current.send({
          type: 'broadcast',
          event: 'user_typing',
          payload: {
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentUserAvatar,
            avatarBgColor: currentUserBgColor,
            isTyping: false
          }
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      lastTypingBroadcastTimeRef.current = 0;
      return;
    }

    const now = Date.now();
    // Broadcast instantly on the first character, and every 1.5 seconds while continuing to type
    const shouldBroadcast = !isTypingLocalRef.current || (now - lastTypingBroadcastTimeRef.current > 1500);

    if (shouldBroadcast) {
      isTypingLocalRef.current = true;
      lastTypingBroadcastTimeRef.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'user_typing',
        payload: {
          userId: currentUserId,
          username: currentUsername,
          avatarUrl: currentUserAvatar,
          avatarBgColor: currentUserBgColor,
          isTyping: true
        }
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingLocalRef.current = false;
      lastTypingBroadcastTimeRef.current = 0;
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'user_typing',
          payload: {
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentUserAvatar,
            avatarBgColor: currentUserBgColor,
            isTyping: false
          }
        });
      }
    }, 2500);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    // Reset local typing indicator on submit
    if (isTypingLocalRef.current) {
      isTypingLocalRef.current = false;
      lastTypingBroadcastTimeRef.current = 0;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'user_typing',
          payload: {
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentUserAvatar,
            avatarBgColor: currentUserBgColor,
            isTyping: false
          }
        });
      }
    }

    const textToSend = inputMessage;
    setInputMessage('');
    setShowEmojiPicker(false);

    // Save reply state before clearing
    const replyToData = replyingTo ? {
      id: replyingTo.id,
      username: replyingTo.username,
      content: replyingTo.content
    } : null;
    setReplyingTo(null);

    // Generate client-side unique ID
    const tempId = 'msg_' + Math.random().toString(36).substring(2, 11);

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      userId: currentUserId,
      username: currentUsername,
      avatarUrl: currentUserAvatar,
      avatarBgColor: currentUserBgColor,
      content: textToSend,
      createdAt: new Date().toISOString(),
      localReceivedAt: Date.now(),
      replyTo: replyToData
    };

    // Render immediately to user UI (Optimistic update)
    setMessages(prev => {
      if (prev.some(m => m.id === optimisticMessage.id)) return prev;
      const updated = [...prev, optimisticMessage];
      saveToLocalCache(updated);
      return updated;
    });
    setTimeout(scrollToBottom, 100);

    // Broadcast to other users in real-time immediately via Supabase Realtime
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: optimisticMessage
      });
    }

    // Attempt backend save (Supabase first, fallback to Express API)
    let saveSuccess = false;
    try {
      // 1. Try Supabase
      const { data: sbData, error } = await supabase
        .from('chat_messages')
        .insert([{
          id: optimisticMessage.id,
          userId: optimisticMessage.userId,
          username: optimisticMessage.username,
          avatarUrl: optimisticMessage.avatarUrl,
          avatarBgColor: optimisticMessage.avatarBgColor,
          content: optimisticMessage.content,
          createdAt: optimisticMessage.createdAt,
          replyTo: optimisticMessage.replyTo
        }])
        .select('*');

      if (!error && sbData && sbData[0]) {
        saveSuccess = true;
        const savedMessage = sbData[0];
        setMessages(prev => {
          const index = prev.findIndex(m => m.id === tempId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = savedMessage;
            saveToLocalCache(updated);
            return updated;
          }
          return prev;
        });
      } else if (error) {
        console.warn('Supabase save message error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase save message failed:', err);
    }

    if (!saveSuccess) {
      // 2. Fallback to API
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentUserAvatar,
            avatarBgColor: currentUserBgColor,
            content: textToSend,
            replyTo: replyToData
          })
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const savedMessage = await response.json();
            // Replace optimistic message with saved one
            setMessages(prev => {
              const index = prev.findIndex(m => m.id === tempId);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = savedMessage;
                saveToLocalCache(updated);
                return updated;
              }
              return prev;
            });
          } else {
            console.warn('API backend saved message but did not return JSON. Retaining optimistic message.');
          }
        } else {
          console.warn('API backend failed to save message. Falling back to local/realtime storage.');
        }
      } catch (error) {
        console.error('Failed to save message to backend:', error);
      }
    }
  };

  const handleSaveGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNameInput.trim()) return;
    const name = tempNameInput.trim();
    setGuestName(name);
    localStorage.setItem('chat_guest_name', name);
    setIsSettingName(false);
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    // 1. Optimistic update
    let updatedReactions: { [emoji: string]: string[] } = {};
    
    setMessages(prev => {
      const updated = prev.map(m => {
        if (m.id === messageId) {
          const currentReactions = m.reactions || {};
          const userList = (currentReactions[emoji] || []) as string[];
          const hasReacted = userList.includes(currentUserId);
          
          let nextUserList = [...userList];
          if (hasReacted) {
            nextUserList = nextUserList.filter(uid => uid !== currentUserId);
          } else {
            nextUserList.push(currentUserId);
          }
          
          const nextReactions = { ...currentReactions };
          if (nextUserList.length === 0) {
            delete nextReactions[emoji];
          } else {
            nextReactions[emoji] = nextUserList;
          }
          
          updatedReactions = nextReactions;
          return { ...m, reactions: nextReactions, reactionsLocalUpdate: Date.now() };
        }
        return m;
      });
      saveToLocalCache(updated);
      return updated;
    });

    // 2. Broadcast immediately to all connected clients
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'message_reaction',
        payload: { messageId, emoji, userId: currentUserId, reactions: updatedReactions }
      });
    }

    // 3. Save to database / api backend with Read-Modify-Write cycle
    try {
      // Fetch latest from Supabase first to merge concurrently added reactions
      const { data: latestMsg, error: fetchError } = await supabase
        .from('chat_messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      let finalReactions = updatedReactions;
      if (!fetchError && latestMsg) {
        const serverReactions = (latestMsg.reactions || {}) as { [emoji: string]: string[] };
        
        // Toggle current user's reaction on top of latest server-state to preserve others' updates
        const userList = (serverReactions[emoji] || []) as string[];
        const hasReacted = userList.includes(currentUserId);
        
        let nextUserList = [...userList];
        if (hasReacted) {
          nextUserList = nextUserList.filter(uid => uid !== currentUserId);
        } else {
          nextUserList.push(currentUserId);
        }
        
        const nextReactions = { ...serverReactions };
        if (nextUserList.length === 0) {
          delete nextReactions[emoji];
        } else {
          nextReactions[emoji] = nextUserList;
        }
        finalReactions = nextReactions;
      }

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ reactions: finalReactions })
        .eq('id', messageId);
        
      if (!updateError) {
        // If successful, update local state with final merged reactions and broadcast
        setMessages(prev => {
          const updated = prev.map(m => {
            if (m.id === messageId) {
              return { ...m, reactions: finalReactions, reactionsLocalUpdate: Date.now() };
            }
            return m;
          });
          saveToLocalCache(updated);
          return updated;
        });

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'message_reaction',
            payload: { messageId, emoji, userId: currentUserId, reactions: finalReactions }
          });
        }
      } else {
        console.warn('Supabase reactions update error (using fallback):', updateError.message);
        // Fallback to API if Supabase column update fails
        const res = await fetch('/api/chat/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, emoji, userId: currentUserId })
        });
        if (res.ok) {
          const updatedMsg = await res.json();
          if (updatedMsg && updatedMsg.reactions) {
            setMessages(prev => {
              const updated = prev.map(m => {
                if (m.id === messageId) {
                  return { ...m, reactions: updatedMsg.reactions, reactionsLocalUpdate: Date.now() };
                }
                return m;
              });
              saveToLocalCache(updated);
              return updated;
            });

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'message_reaction',
                payload: { messageId, emoji, userId: currentUserId, reactions: updatedMsg.reactions }
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Reactions save failed, running on fallback API:', err);
      try {
        const res = await fetch('/api/chat/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, emoji, userId: currentUserId })
        });
        if (res.ok) {
          const updatedMsg = await res.json();
          if (updatedMsg && updatedMsg.reactions) {
            setMessages(prev => {
              const updated = prev.map(m => {
                if (m.id === messageId) {
                  return { ...m, reactions: updatedMsg.reactions, reactionsLocalUpdate: Date.now() };
                }
                return m;
              });
              saveToLocalCache(updated);
              return updated;
            });

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'message_reaction',
                payload: { messageId, emoji, userId: currentUserId, reactions: updatedMsg.reactions }
              });
            }
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback reactions save failed:', fallbackErr);
      }
    }
  };

  const handleSaveSettings = (newName: string, avatarUrl: string, bgColor: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCustomUsername(trimmed);
    localStorage.setItem(`chat_custom_username_${currentUserId}`, trimmed);

    setCustomAvatarUrl(avatarUrl);
    localStorage.setItem(`chat_custom_avatar_${currentUserId}`, avatarUrl);

    setCustomAvatarBgColor(bgColor);
    localStorage.setItem(`chat_custom_bg_${currentUserId}`, bgColor);

    setShowSettings(false);
  };

  const addEmoji = (emoji: string) => {
    handleLocalTyping(inputMessage + emoji);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full h-full max-w-4xl mx-auto bg-white dark:bg-gray-900 flex flex-col overflow-hidden sm:border-x border-gray-100 dark:border-gray-800 shadow-2xl"
      >
        {/* Header (Instagram Style) */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
            <div className="text-right">
              <h2 className="text-sm font-black dark:text-white flex items-center gap-1.5">
                <span>المحادثة العامة للمجتمع 💬</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                {activeUsersCount} نشط الآن في الغرفة
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Settings Button */}
            {!isSettingName && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="إعدادات الحساب"
                id="chat-settings-btn"
              >
                <Settings size={18} className={showSettings ? "animate-spin" : ""} />
                <span className="text-xs font-black hidden sm:inline">الإعدادات</span>
              </button>
            )}

            {/* Hash Badge */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 p-[1.5px] flex items-center justify-center shadow-md shrink-0">
              <div className="w-full h-full bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
                <Hash size={14} className="text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-gray-50/50 dark:bg-gray-950/20">
          <AnimatePresence mode="wait">
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-40 p-4 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-md"
              >
                <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-850 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 space-y-5 relative scrollbar-thin text-right">
                  
                  {/* Close button inside settings */}
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-4 left-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>

                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">إعدادات ملفك الشخصي</h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">تغيير الاسم المستعار ومظهر الصورة الشخصية</p>
                  </div>

                  {/* Profile Picture Preview Area */}
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-20 h-20 rounded-full flex items-center justify-center shadow-md overflow-hidden bg-white dark:bg-gray-800 border"
                      style={{ borderColor: settingsBgColor || '#8B5CF6', borderWidth: '3.5px' }}
                    >
                      <img 
                        src={settingsAvatarInput || rawDefaultAvatar} 
                        alt="الملف الشخصي" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                      معاينة صورتك الشخصية
                    </span>
                  </div>

                  {/* Nickname Form & Admin Login */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {isAdmin ? (
                        <span className="text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                          👑 أنت أدمن
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowAdminLogin(true)}
                          className="text-[10px] font-black text-purple-600 hover:text-purple-700 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          🔑 الدخول ك أدمن
                        </button>
                      )}
                      <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mr-1 text-right">
                        الاسم المستعار (اللقب)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={settingsNameInput}
                      onChange={(e) => setSettingsNameInput(e.target.value)}
                      maxLength={20}
                      className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-right"
                      placeholder="اكتب اسمك المستعار..."
                    />
                  </div>

                  {/* Background Color Selector */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mr-1 text-right">
                      اختر لون إطار الصورة الشخصية
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {BG_COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSettingsBgColor(color)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 ${
                            settingsBgColor === color 
                              ? 'border-purple-600 scale-110 ring-2 ring-purple-500/20' 
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Avatar Template Grid */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 mr-1 text-right">
                      اختر شخصيتك (الافتار)
                    </label>
                    <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 justify-items-center">
                      {avatarTemplates.map((template) => {
                        const isSelected = settingsAvatarInput === template.imageUrl;
                        return (
                          <div key={template.id} className="flex flex-col items-center gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => setSettingsAvatarInput(template.imageUrl)}
                              className="relative w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-105 overflow-hidden shadow-sm bg-white dark:bg-gray-800"
                              style={{ 
                                borderColor: isSelected ? settingsBgColor : '#E5E7EB',
                                borderWidth: '2.5px'
                              }}
                            >
                              <img 
                                src={template.imageUrl} 
                                alt={template.name} 
                                className="w-full h-full object-cover rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                            <span 
                              className="text-[9px] font-bold text-gray-500 dark:text-gray-400 text-center truncate w-full px-0.5"
                              title={template.name}
                            >
                              {template.name}
                            </span>
                          </div>
                        );
                      })}
                      {avatarTemplates.length === 0 && (
                        <p className="col-span-4 text-[10px] text-gray-400 font-bold text-center py-4">
                          لا تتوفر افتارات حالياً.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Admin Configuration Panel */}
                  {isAdmin && (
                    <div className="p-4 border border-purple-200 dark:border-purple-900 rounded-2xl bg-purple-50/30 dark:bg-purple-950/20 space-y-3 text-right">
                      <h4 className="text-[11px] font-black text-purple-700 dark:text-purple-400 text-right flex items-center gap-1.5 justify-end">
                        <span>لوحة تحكم الأدمن 👑</span>
                      </h4>
                      
                      {/* Supabase Database Setup Helper */}
                      <div className="p-3 bg-white dark:bg-gray-900 border border-purple-100 dark:border-purple-950 rounded-xl space-y-2 text-right">
                        <button
                          type="button"
                          onClick={() => setShowSqlSetup(!showSqlSetup)}
                          className="w-full flex items-center justify-between text-[11px] font-black text-purple-700 dark:text-purple-400 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            {supabaseTablesMissing && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                            {showSqlSetup ? '▲ إخفاء دليل قواعد البيانات' : '▼ تهيئة جداول Supabase (SQL)'}
                          </span>
                          <span className="flex items-center gap-1">
                            {supabaseTablesMissing ? '⚠️ جداول المحادثة غير موجودة' : '⚙️ إعداد قاعدة البيانات'}
                          </span>
                        </button>

                        {showSqlSetup && (
                          <div className="pt-2 text-[10px] space-y-2.5 border-t border-purple-50 dark:border-purple-950/40 text-gray-600 dark:text-gray-400 font-bold leading-relaxed">
                            <p className="text-red-600 dark:text-red-400">
                              ملاحظة: تظهر هذه الخطوة لأن جداول المحادثة (chat_messages أو chat_avatars) لم يتم إنشاؤها بعد في مشروع Supabase الخاص بك.
                            </p>
                            <div className="bg-purple-50/50 dark:bg-purple-950/10 p-2.5 rounded-lg border text-right space-y-1">
                              <p className="text-purple-700 dark:text-purple-300 font-black">خطوات التهيئة السريعة:</p>
                              <ol className="list-decimal list-inside space-y-1 text-gray-500">
                                <li>اذهب إلى لوحة تحكم <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">Supabase</a> الخاصة بمشروعك.</li>
                                <li>افتح قسم <strong className="text-gray-800 dark:text-white">SQL Editor</strong> من القائمة الجانبية اليسرى.</li>
                                <li>اضغط على <strong className="text-gray-800 dark:text-white">New Query</strong> لإنشاء استعلام جديد.</li>
                                <li>قم بنسخ الرمز البرمجي أدناه بالكامل والصقه في المحرر.</li>
                                <li>اضغط على زر <strong className="text-purple-600">Run</strong> في الجزء السفلي الأيمن لتنفيذ الأمر.</li>
                              </ol>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-black text-gray-400">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sql = `-- استعلام تهيئة جداول المحادثة والافتارات في Supabase

-- 1. جدول الرسائل (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    username TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarBgColor" TEXT,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تنشيط سياسة الحماية والوصول (Row Level Security) لجدول الرسائل
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- سياسة السماح لجميع الزوار بقراءة الرسائل
CREATE POLICY "Allow public read access to chat_messages" 
ON public.chat_messages FOR SELECT 
USING (true);

-- سياسة السماح لجميع الزوار بإضافة رسائل جديدة
CREATE POLICY "Allow public insert access to chat_messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (true);

-- سياسة السماح لجميع الزوار بتحديث الرسائل (لتحديث التفاعلات)
CREATE POLICY "Allow public update access to chat_messages" 
ON public.chat_messages FOR UPDATE 
USING (true)
WITH CHECK (true);

-- سياسة السماح بحذف الرسائل
CREATE POLICY "Allow public delete access to chat_messages" 
ON public.chat_messages FOR DELETE 
USING (true);


-- 2. جدول قوالب الافتارات (chat_avatars)
CREATE TABLE IF NOT EXISTS public.chat_avatars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تنشيط سياسة الحماية والوصول لجدول الافتارات
ALTER TABLE public.chat_avatars ENABLE ROW LEVEL SECURITY;

-- سياسة السماح للجميع بمشاهدة الافتارات المتاحة
CREATE POLICY "Allow public read access to chat_avatars" 
ON public.chat_avatars FOR SELECT 
USING (true);

-- سياسة السماح بإضافة قوالب افتارات جديدة
CREATE POLICY "Allow public insert access to chat_avatars" 
ON public.chat_avatars FOR INSERT 
WITH CHECK (true);

-- سياسة السماح بحذف قوالب الافتارات
CREATE POLICY "Allow public delete access to chat_avatars" 
ON public.chat_avatars FOR DELETE 
USING (true);

-- في حال كان الجدول مفعلاً لديك مسبقاً، يمكنك تشغيل هذه الأوامر لإضافة ميزة التفاعل والرد والسياسات:
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS "replyTo" JSONB DEFAULT NULL;
-- CREATE POLICY "Allow public update access to chat_messages" ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);`;
                                    navigator.clipboard.writeText(sql);
                                    alert('تم نسخ كود SQL بنجاح! يمكن الآن لصقه في Supabase ✅');
                                  }}
                                  className="text-purple-600 hover:text-purple-700 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  📋 نسخ الكود الكامل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText("ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb; ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS \"replyTo\" JSONB DEFAULT NULL;");
                                    alert('تم نسخ أوامر الترقية (إضافة التفاعلات والردود)! قم بتشغيلها في Supabase SQL Editor لترقية مشروعك الحالي 🚀');
                                  }}
                                  className="text-amber-600 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1 mr-auto"
                                >
                                  ⚡ نسخ أمر الترقية فقط (إضافة التفاعلات والردود لجدولك الحالي)
                                </button>
                                <span>رمز الاستعلام لإنشاء الجداول والسياسات:</span>
                              </div>
                              <pre className="p-2 bg-gray-950 text-emerald-400 rounded-lg text-[8px] font-mono overflow-x-auto text-left leading-normal border border-gray-800 select-all max-h-36 overflow-y-auto">
{`-- 1. Create chat_messages table (with reactions and reply support)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    username TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarBgColor" TEXT,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '{}'::jsonb,
    "replyTo" JSONB DEFAULT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Upgrade existing table commands:
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS "replyTo" JSONB DEFAULT NULL;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to chat_messages" 
ON public.chat_messages FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to chat_messages" 
ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to chat_messages" 
ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to chat_messages" 
ON public.chat_messages FOR DELETE USING (true);

-- 2. Create chat_avatars table
CREATE TABLE IF NOT EXISTS public.chat_avatars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to chat_avatars" 
ON public.chat_avatars FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to chat_avatars" 
ON public.chat_avatars FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access to chat_avatars" 
ON public.chat_avatars FOR DELETE USING (true);`}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Create Template Form */}
                      <div className="space-y-2 text-right">
                        <p className="text-[9px] font-bold text-gray-400">إضافة افتار جديد يستطيع المستخدمون استخدامه</p>
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          className="w-full px-3 py-2 text-[11px] font-bold rounded-lg border border-purple-100 dark:border-purple-900 bg-white dark:bg-gray-900 text-right focus:outline-none text-gray-800 dark:text-white"
                          placeholder="اسم الافتار (مثال: مستكشف)"
                        />
                        <input
                          type="text"
                          value={newTemplateUrl}
                          onChange={(e) => setNewTemplateUrl(e.target.value)}
                          className="w-full px-3 py-2 text-[11px] font-bold rounded-lg border border-purple-100 dark:border-purple-900 bg-white dark:bg-gray-900 text-right focus:outline-none text-gray-800 dark:text-white"
                          placeholder="رابط صورة الافتار (URL)"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newTemplateName.trim() || !newTemplateUrl.trim()) {
                              alert('يرجى ملء جميع الحقول');
                              return;
                            }
                            
                            let sbAddSuccess = false;
                            try {
                              // 1. Try Supabase
                              const { data: sbData, error } = await supabase
                                .from('chat_avatars')
                                .insert([{
                                  name: newTemplateName.trim(),
                                  imageUrl: newTemplateUrl.trim()
                                }])
                                .select('*');
                              
                              if (!error && sbData) {
                                sbAddSuccess = true;
                                setNewTemplateName('');
                                setNewTemplateUrl('');
                                // Refresh templates list from Supabase
                                const { data: refreshData } = await supabase
                                  .from('chat_avatars')
                                  .select('*')
                                  .order('name', { ascending: true });
                                if (refreshData) {
                                  setAvatarTemplates(refreshData);
                                }
                              } else if (error) {
                                console.warn('Supabase add avatar error:', error.message);
                              }
                            } catch (err) {
                              console.warn('Supabase add avatar failed:', err);
                            }

                            if (!sbAddSuccess) {
                              // 2. Fallback to API
                              try {
                                const res = await fetch('/api/avatars', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: newTemplateName, imageUrl: newTemplateUrl })
                                });
                                if (res.ok) {
                                  const contentType = res.headers.get('content-type');
                                  if (contentType && contentType.includes('application/json')) {
                                    setNewTemplateName('');
                                    setNewTemplateUrl('');
                                    const updatedList = await res.json();
                                    setAvatarTemplates(updatedList);
                                  } else {
                                    // If not JSON but OK
                                    console.warn('API returned success but not JSON. Adding locally to state.');
                                    const mockId = Math.random().toString(36).substring(2, 11);
                                    const localAdded = [...avatarTemplates, { id: mockId, name: newTemplateName.trim(), imageUrl: newTemplateUrl.trim() }];
                                    setAvatarTemplates(localAdded);
                                    setNewTemplateName('');
                                    setNewTemplateUrl('');
                                  }
                                } else {
                                  alert('فشل إضافة الافتار');
                                }
                              } catch (err) {
                                console.error(err);
                                alert('حدث خطأ أثناء إضافة الافتار');
                              }
                            }
                          }}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer"
                        >
                          إضافة الافتار للمجموعة ➕
                        </button>
                      </div>

                      {/* List / Delete templates */}
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] font-black text-purple-700 dark:text-purple-400 mr-0.5 text-right">الافتارات المتاحة للحذف:</p>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                          {avatarTemplates.map((template) => {
                            const isDeleting = deleteConfirmId === template.id;
                            return (
                              <div key={template.id} className="flex items-center justify-between bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-purple-100 dark:border-purple-950">
                                <div className="flex gap-1.5">
                                  {isDeleting ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          let sbDeleteSuccess = false;
                                          try {
                                            // 1. Try Supabase
                                            const { error } = await supabase
                                              .from('chat_avatars')
                                              .delete()
                                              .eq('id', template.id);
                                            
                                            if (!error) {
                                              sbDeleteSuccess = true;
                                              setDeleteConfirmId(null);
                                              // Refresh list from Supabase
                                              const { data: refreshData } = await supabase
                                                .from('chat_avatars')
                                                .select('*')
                                                .order('name', { ascending: true });
                                              if (refreshData) {
                                                setAvatarTemplates(refreshData);
                                              }
                                            } else {
                                              console.warn('Supabase delete avatar error:', error.message);
                                            }
                                          } catch (err) {
                                            console.warn('Supabase delete avatar failed:', err);
                                          }

                                          if (!sbDeleteSuccess) {
                                            // 2. Fallback to API
                                            try {
                                              const res = await fetch(`/api/avatars/${template.id}`, {
                                                method: 'DELETE'
                                              });
                                              if (res.ok) {
                                                const contentType = res.headers.get('content-type');
                                                if (contentType && contentType.includes('application/json')) {
                                                  const updatedList = await res.json();
                                                  setAvatarTemplates(updatedList);
                                                  setDeleteConfirmId(null);
                                                } else {
                                                  console.warn('API returned success but not JSON. Deleting from local state.');
                                                  setAvatarTemplates(prev => prev.filter(av => av.id !== template.id));
                                                  setDeleteConfirmId(null);
                                                }
                                              } else {
                                                let errText = 'خطأ غير معروف';
                                                try {
                                                  const contentType = res.headers.get('content-type');
                                                  if (contentType && contentType.includes('application/json')) {
                                                    const errData = await res.json();
                                                    errText = errData.error || errText;
                                                  }
                                                } catch (e) {}
                                                alert(`فشل حذف الافتار: ${errText}`);
                                              }
                                            } catch (err) {
                                              console.error(err);
                                              alert('حدث خطأ غير متوقع أثناء الحذف');
                                            }
                                          }
                                        }}
                                        className="text-[8px] font-black text-white bg-red-600 hover:bg-red-750 px-2 py-1 rounded cursor-pointer"
                                      >
                                        تأكيد ⚠️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="text-[8px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded cursor-pointer"
                                      >
                                        إلغاء
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmId(template.id)}
                                      className="text-[9px] font-extrabold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded cursor-pointer animate-none"
                                    >
                                      حذف 🗑️
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{template.name}</span>
                                  <div 
                                    className="w-7 h-7 rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 border"
                                    style={{ borderColor: settingsBgColor, borderWidth: '2px' }}
                                  >
                                    <img 
                                      src={template.imageUrl} 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Clear Chat History */}
                      <div className="pt-2 border-t border-purple-100 dark:border-purple-950 space-y-2">
                        {confirmClearChat ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                let sbClearSuccess = false;
                                try {
                                  // 1. Try Supabase - delete all messages
                                  const { error } = await supabase
                                    .from('chat_messages')
                                    .delete()
                                    .neq('id', 'placeholder_nonexistent'); // standard trick to delete all rows
                                  
                                  if (!error) {
                                    sbClearSuccess = true;
                                    alert('تم مسح تاريخ المحادثة بالكامل بنجاح! ✅');
                                    setConfirmClearChat(false);
                                    setMessages([]);
                                    saveToLocalCache([]);
                                    if (channelRef.current) {
                                      channelRef.current.send({
                                        type: 'broadcast',
                                        event: 'clear_chat',
                                        payload: {}
                                      });
                                    }
                                  } else {
                                    console.warn('Supabase clear chat error:', error.message);
                                  }
                                } catch (err) {
                                  console.warn('Supabase clear chat failed:', err);
                                }

                                if (!sbClearSuccess) {
                                  // 2. Fallback to API
                                  try {
                                    const res = await fetch('/api/chat/clear', {
                                      method: 'DELETE'
                                    });
                                    if (res.ok) {
                                      alert('تم مسح تاريخ المحادثة بالكامل بنجاح! ✅');
                                      setConfirmClearChat(false);
                                      setMessages([]);
                                      saveToLocalCache([]);
                                      if (channelRef.current) {
                                        channelRef.current.send({
                                          type: 'broadcast',
                                          event: 'clear_chat',
                                          payload: {}
                                        });
                                      }
                                    } else {
                                      alert('فشل مسح تاريخ المحادثة');
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert('حدث خطأ أثناء مسح المحادثة');
                                  }
                                }
                              }}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-750 text-white text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer text-center"
                            >
                              تأكيد مسح كل المحادثات ⚠️
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearChat(false)}
                              className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold rounded-lg transition-colors cursor-pointer text-center"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearChat(true)}
                            className="w-full py-2 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer text-center"
                          >
                            مسح تاريخ المحادثة بالكامل 🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSaveSettings(settingsNameInput, settingsAvatarInput, settingsBgColor)}
                      disabled={!settingsNameInput.trim()}
                      className="flex-1 py-2.5 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-md shadow-purple-600/10 transition-colors cursor-pointer"
                    >
                      حفظ التعديلات
                    </button>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                </div>

                {/* Admin Password Login Overlay */}
                {showAdminLogin && (
                  <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xs bg-white dark:bg-gray-850 p-5 rounded-2xl shadow-xl space-y-4 border border-gray-100 dark:border-gray-800 text-center">
                      <div className="text-center space-y-1">
                        <h4 className="text-xs font-black text-gray-900 dark:text-white">تسجيل الدخول كأدمن 🔑</h4>
                        <p className="text-[9px] font-bold text-gray-400">الرجاء إدخال الرمز السري لتفعيل صلاحيات المشرف</p>
                      </div>
                      <input
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (adminPasswordInput === 'admin') {
                              setIsAdmin(true);
                              localStorage.setItem(`chat_is_admin_${currentUserId}`, 'true');
                              setShowAdminLogin(false);
                              setAdminPasswordInput('');
                            } else {
                              alert('الرمز السري غير صحيح!');
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs font-bold text-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none"
                        placeholder="أدخل الرمز السري..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (adminPasswordInput === 'admin') {
                              setIsAdmin(true);
                              localStorage.setItem(`chat_is_admin_${currentUserId}`, 'true');
                              setShowAdminLogin(false);
                              setAdminPasswordInput('');
                            } else {
                              alert('الرمز السري غير صحيح!');
                            }
                          }}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-extrabold rounded-xl cursor-pointer"
                        >
                          تأكيد ✅
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAdminLogin(false);
                            setAdminPasswordInput('');
                          }}
                          className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold rounded-xl cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {isSettingName ? (
              /* Set Guest Name Form */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0 z-30 p-8 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-900"
              >
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">أهلاً بك في الدردشة العامة!</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-xs leading-relaxed font-semibold">
                  بما أنك تستخدم التطبيق كزائر، يرجى اختيار اسم مستعار لتبدأ التواصل مع بقية مجتمع العادات في الوقت الفعلي.
                </p>
                <form onSubmit={handleSaveGuestName} className="w-full max-w-xs space-y-3">
                  <input
                    type="text"
                    required
                    maxLength={20}
                    placeholder="اكتب اسمك المستعار هنا..."
                    value={tempNameInput}
                    onChange={e => setTempNameInput(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    بدء الدردشة الآن 🚀
                  </button>
                </form>
              </motion.div>
            ) : loading ? (
              /* Loading Spinner */
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-gray-400 font-bold">جاري تحميل الرسائل...</p>
              </div>
            ) : messages.length === 0 ? (
              /* Empty Chat State */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
                  <Smile size={32} />
                </div>
                <h4 className="text-sm font-black text-gray-800 dark:text-gray-200">الدردشة خالية حالياً</h4>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-semibold max-w-xs">
                  كن أول من يبدأ المحادثة ويرسل تحية لجميع مستخدمي التطبيق!
                </p>
              </div>
            ) : (
              /* Message List */
              <div 
                ref={scrollContainerRef} 
                onScroll={() => {
                  if (activeEmojiPickerMsgId) {
                    setActiveEmojiPickerMsgId(null);
                  }
                }}
                onClick={(e) => {
                  // Only close if clicking on the background container, not on interactive elements
                  if (e.target === e.currentTarget) {
                    setActiveEmojiPickerMsgId(null);
                  }
                }}
                className="w-full h-full overflow-y-auto px-4 py-6 flex flex-col no-scrollbar"
              >
                {(() => {
                  const seen = new Set<string>();
                  const uniqueMsgs = messages.filter(m => {
                    if (!m.id) return false;
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                  });
                  return uniqueMsgs.map((msg, idx) => {
                    const isMe = msg.userId === currentUserId;
                    const prevMsg = idx > 0 ? uniqueMsgs[idx - 1] : null;
                    const nextMsg = idx < uniqueMsgs.length - 1 ? uniqueMsgs[idx + 1] : null;
                    
                    // A message is consecutive if it's sent by the same user within 60 seconds (1 minute)
                    const isConsecutiveWithPrev = prevMsg && prevMsg.userId === msg.userId && 
                      (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 60000);
                    const isConsecutiveWithNext = nextMsg && nextMsg.userId === msg.userId && 
                      (new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() < 60000);

                  const showSenderHeader = !isMe && (!prevMsg || prevMsg.userId !== msg.userId || !isConsecutiveWithPrev);
                  
                  // Bubble corner styling based on consecutive status
                  let bubbleCorners = '';
                  if (isMe) {
                    if (isConsecutiveWithPrev && isConsecutiveWithNext) {
                      bubbleCorners = 'rounded-2xl rounded-tl-md rounded-bl-md';
                    } else if (isConsecutiveWithPrev) {
                      bubbleCorners = 'rounded-2xl rounded-tl-md';
                    } else if (isConsecutiveWithNext) {
                      bubbleCorners = 'rounded-2xl rounded-bl-md rounded-tl-sm';
                    } else {
                      bubbleCorners = 'rounded-2xl rounded-tl-sm';
                    }
                  } else {
                    if (isConsecutiveWithPrev && isConsecutiveWithNext) {
                      bubbleCorners = 'rounded-2xl rounded-tr-md rounded-br-md';
                    } else if (isConsecutiveWithPrev) {
                      bubbleCorners = 'rounded-2xl rounded-tr-md';
                    } else if (isConsecutiveWithNext) {
                      bubbleCorners = 'rounded-2xl rounded-br-md rounded-tr-sm';
                    } else {
                      bubbleCorners = 'rounded-2xl rounded-tr-sm';
                    }
                  }

                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-2.5 max-w-[85%] ${
                        isMe ? 'mr-auto flex-row-reverse text-left' : 'ml-auto text-right'
                      } ${isConsecutiveWithPrev ? 'mt-1' : idx === 0 ? 'mt-0' : 'mt-4'}`}
                    >
                      {/* Avatar */}
                      {!isMe && (
                        isConsecutiveWithPrev ? (
                          <div className="w-8 shrink-0" />
                        ) : (
                          <div 
                            className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 mt-0.5 overflow-hidden bg-white dark:bg-gray-800 border"
                            style={{ borderColor: msg.avatarBgColor || '#8B5CF6', borderWidth: '2.5px' }}
                          >
                            <img 
                              src={msg.avatarUrl} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )
                      )}
                      
                      <div className="flex flex-col gap-0.5 relative group min-w-0">
                        {/* Sender Name */}
                        {showSenderHeader && (
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 px-1">
                            {msg.username}
                          </span>
                        )}
                        
                        {/* Message Bubble + Actions */}
                        <div className={`flex items-center gap-2 relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div 
                            className={`px-4 py-2.5 text-xs font-bold leading-relaxed shadow-sm max-w-full break-words select-text ${
                              isMe 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100/50 dark:border-gray-700/40'
                            } ${bubbleCorners}`}
                          >
                            {/* Reply preview inside bubble */}
                            {msg.replyTo && (
                              <div className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-r-2 text-right text-[10px] font-bold ${
                                isMe 
                                  ? 'bg-blue-700/50 border-white text-blue-100' 
                                  : 'bg-gray-100/80 dark:bg-gray-700/60 border-blue-500 text-gray-600 dark:text-gray-300'
                              }`}>
                                <div className="font-black text-[9px] text-blue-500 dark:text-blue-400 mb-0.5">
                                  {msg.replyTo.username}
                                </div>
                                <div className="truncate max-w-[180px]">
                                  {msg.replyTo.content}
                                </div>
                              </div>
                            )}

                            <div>{msg.content}</div>
                          </div>

                          {/* Quick Reaction & Reply trigger buttons */}
                          <div className="opacity-100 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 flex items-center gap-1 relative select-none shrink-0">
                            {/* Smile Button */}
                            <button
                              type="button"
                              onClick={() => setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                              title="تفاعل مع الرسالة"
                            >
                              <Smile size={13} />
                            </button>

                            {/* Reply Button */}
                            <button
                              type="button"
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                              title="رد على الرسالة"
                            >
                              <CornerUpLeft size={13} />
                            </button>

                            {/* Hover/Click Emoji picker modal (Smarter positioning to avoid cutting off) */}
                            {activeEmojiPickerMsgId === msg.id && (
                              <div className={`absolute bottom-full z-50 mb-1 flex items-center gap-1.5 p-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full shadow-lg ${isMe ? 'left-0' : 'right-0'}`}>
                                {QUICK_EMOJIS.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      handleReactToMessage(msg.id, emoji);
                                      setActiveEmojiPickerMsgId(null);
                                    }}
                                    className="hover:scale-130 active:scale-95 transition-transform p-0.5 text-sm cursor-pointer select-none leading-none"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reaction Display Pills */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([emoji, userIdsValue]) => {
                              const userIds = userIdsValue as string[];
                              if (!userIds || userIds.length === 0) return null;
                              const hasIReacted = userIds.includes(currentUserId);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleReactToMessage(msg.id, emoji)}
                                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black transition-all border shrink-0 ${
                                    hasIReacted 
                                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 scale-105 shadow-sm' 
                                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                                  title={`${userIds.length} تفاعل`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-sans leading-none">{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Time - Show only for the last message in consecutive sequence */}
                        {!isConsecutiveWithNext && (
                          <span className="text-[8px] text-gray-400 dark:text-gray-500 font-semibold px-1 mt-0.5">
                            {format(new Date(msg.createdAt), 'hh:mm a', { locale: ar })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
                
                {/* Visual Typing Indicators */}
                {Object.entries(typingUsers).map(([id, tUser]) => {
                  const userObj = tUser as { username: string; avatarUrl: string; avatarBgColor?: string };
                  return (
                    <div 
                      key={`typing_${id}`}
                      className="flex gap-2.5 max-w-[85%] ml-auto text-right items-start animate-pulse mt-4"
                    >
                      <div 
                        className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 mt-0.5 overflow-hidden bg-white dark:bg-gray-800 border"
                        style={{ borderColor: userObj.avatarBgColor || '#8B5CF6', borderWidth: '2.5px' }}
                      >
                        <img 
                          src={userObj.avatarUrl} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 px-1">
                          {userObj.username}
                        </span>
                        <div className="px-4 py-2.5 rounded-2xl text-xs font-bold leading-relaxed shadow-sm bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-tr-sm border border-gray-100/50 dark:border-gray-700/40 flex items-center gap-1.5">
                          <span>جاري الكتابة</span>
                          <span className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Emoji Shelf */}
        {!isSettingName && (
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-2.5">
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="text-lg hover:scale-125 transition-transform duration-150 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {!user && (
              <button
                onClick={() => setIsSettingName(true)}
                className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-md"
              >
                <LogIn size={10} />
                <span>تغيير الاسم</span>
              </button>
            )}
          </div>
        )}

        {/* Reply Bar preview */}
        {!isSettingName && replyingTo && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 shrink-0 text-right">
            <div className="flex-1 min-w-0 border-r-2 border-blue-500 pr-2">
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 block mb-0.5">
                الرد على {replyingTo.username}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">
                {replyingTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full cursor-pointer shrink-0"
              title="إلغاء الرد"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Form */}
        {!isSettingName && (
          <form 
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 shrink-0"
          >
            <div className="flex-1 relative flex items-center bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-3">
              <input
                type="text"
                value={inputMessage}
                onChange={e => handleLocalTyping(e.target.value)}
                placeholder="اكتب رسالة..."
                className="w-full py-2.5 text-xs font-bold bg-transparent border-none text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => addEmoji('🔥')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1"
                title="أرسل شعلة حماس"
              >
                🔥
              </button>
            </div>
            
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                inputMessage.trim() 
                  ? 'bg-blue-600 text-white shadow-md active:scale-95' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send size={16} className="-rotate-180" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
