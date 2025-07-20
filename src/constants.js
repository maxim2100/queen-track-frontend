// Application Constants
export const WEBSOCKET_URLS = {
  LIVE_STREAM: '/video/live-stream',
  NOTIFICATIONS: '/video/notifications',
  EXTERNAL_CAMERA: '/video/external-camera-stream',
};

export const API_ENDPOINTS = {
  // Core endpoints
  CAMERA_CONFIG: '/video/camera-config',
  EXTERNAL_CAMERA_STATUS: '/video/external-camera-status',
  
  // Notifications
  NOTIFICATIONS: '/video/notifications',
  NOTIFICATIONS_MARK_READ: '/video/notifications/mark-all-read',
  NOTIFICATIONS_DELETE_ALL: '/video/notifications',
  
  // Events
  EVENTS: '/events',
  EVENT_BY_ID: (id) => `/video/events/${id}`,
  
  // Settings
  SETTINGS: '/video/settings',
  SETTINGS_PRESETS: '/video/settings/presets',
  SETTINGS_RESET: '/video/settings/reset',
  SETTINGS_APPLY_PRESET: (preset) => `/video/settings/preset/${preset}`,
  
  // File uploads
  UPLOAD: '/video/upload',
  
  // System
  HEALTH: '/health',
  DIAGNOSTICS: '/diagnostics',
  
  // Debug endpoints
  DEBUG_BEE_STATUS: '/video/debug/bee-tracking-status',
  DEBUG_MODEL_INFO: '/video/debug/model-info',
  DEBUG_RESET: '/video/debug/reset-tracking',
  DEBUG_SET_STATUS: '/video/debug/set-initial-status',
};

export const WEBSOCKET_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

export const WEBSOCKET_STATE_NAMES = {
  [WEBSOCKET_STATES.CONNECTING]: 'CONNECTING',
  [WEBSOCKET_STATES.OPEN]: 'OPEN',
  [WEBSOCKET_STATES.CLOSING]: 'CLOSING',
  [WEBSOCKET_STATES.CLOSED]: 'CLOSED',
};

export const CAMERA_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  ERROR: 'error',
  STARTING: 'starting',
};

export const BEE_STATUS = {
  INSIDE: 'inside',
  OUTSIDE: 'outside',
};

export const EVENT_ACTIONS = {
  START_EVENT: 'start_event',
  END_EVENT: 'end_event',
};

export const STREAM_MODES = {
  LIVE: 'live',
  VIDEO: 'video',
};

export const NOTIFICATION_TYPES = {
  BEE_NOTIFICATION: 'bee_notification',
  EXTERNAL_CAMERA_CONTROL: 'external_camera_control',
};

export const EXTERNAL_CAMERA_ACTIONS = {
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',
};

export const DEFAULT_CONFIG = {
  FRAME_SEND_INTERVAL: 100, // milliseconds
  RECONNECT_DELAY: 5000, // milliseconds
  MAX_RETRY_ATTEMPTS: 2,
  RETRY_COOLDOWN: 5000, // milliseconds
  RETRY_RESET_PERIOD: 30000, // milliseconds
  MAX_NOTIFICATIONS: 50,
  STATUS_CHECK_INTERVAL: 5000, // milliseconds
};

export const ERROR_TYPES = {
  CAMERA_NOT_READABLE: 'NotReadableError',
  CAMERA_NOT_ALLOWED: 'NotAllowedError',
  CAMERA_NOT_FOUND: 'NotFoundError',
  CAMERA_OVER_CONSTRAINED: 'OverconstrainedError',
  CONCURRENT_ACCESS_ERROR: 'ConcurrentAccessError',
};

export const ERROR_MESSAGES = {
  [ERROR_TYPES.CAMERA_NOT_READABLE]: {
    he: 'לא ניתן לגשת למצלמה',
    solutions: [
      'המצלמה כבר בשימוש על ידי אפליקציה אחרת',
      'נסה לסגור אפליקציות אחרות שמשתמשות במצלמה',
      'אם שתי המצלמות זהות - הדפדפן עשוי לחסום גישה זמנית',
      'נסה לבחור מצלמה אחרת או עצור את המצלמה הפנימית תחילה',
      'חלק מהדפדפנים מגבילים גישה לשתי מצלמות בו-זמנית'
    ]
  },
  [ERROR_TYPES.CAMERA_NOT_ALLOWED]: {
    he: 'הרשאת גישה למצלמה נדחתה',
    solutions: [
      'לחץ על אייקון המצלמה בסרגל הכתובות',
      'אפשר גישה למצלמה בהגדרות הדפדפן',
      'רענן את הדף ונסה שוב'
    ]
  },
  [ERROR_TYPES.CAMERA_NOT_FOUND]: {
    he: 'המצלמה לא נמצאה',
    solutions: [
      'המצלמה נותקה מהמחשב',
      'בדוק שהמצלמה מחוברת',
      'נסה מצלמה אחרת מהרשימה'
    ]
  },
  [ERROR_TYPES.CAMERA_OVER_CONSTRAINED]: {
    he: 'המצלמה לא תומכת בהגדרות הנדרשות',
    solutions: [
      'נסה מצלמה אחרת מהרשימה',
      'הגדרות המצלמה לא מתאימות'
    ]
  },
  [ERROR_TYPES.CONCURRENT_ACCESS_ERROR]: {
    he: 'שגיאה בגישה לשתי מצלמות בו-זמנית',
    solutions: [
      'הדפדפן עשוי להגביל גישה לשתי מצלמות בו-זמנית',
      'נסה להפעיל מצלמה אחת בכל פעם',
      'השתמש במצלמות שונות אם זמין',
      'רענן את הדף ונסה שוב',
      'שקול לעבור למצב ווידאו במקום מצלמה חיה'
    ]
  }
};

export const LOG_PREFIXES = {
  NOTIFICATION: '🔔 [Notification Service]',
  STREAM: '🎥 [Stream Service]',
  CAMERA: '📷 [Camera Service]',
  WEBSOCKET: '🔌 [WebSocket]',
  API: '🌐 [API]',
  ERROR: '💥 [Error]',
  SUCCESS: '✅ [Success]',
  WARNING: '⚠️ [Warning]',
  INFO: 'ℹ️ [Info]',
};