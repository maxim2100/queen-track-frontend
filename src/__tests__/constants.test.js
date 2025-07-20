import {
  WEBSOCKET_URLS,
  API_ENDPOINTS,
  WEBSOCKET_STATES,
  WEBSOCKET_STATE_NAMES,
  STREAM_MODES,
  LOG_PREFIXES,
  BEE_STATUS,
  CAMERA_STATUS,
  NOTIFICATION_TYPES,
  ERROR_TYPES,
  ERROR_MESSAGES,
  DEFAULT_CONFIG,
  EVENT_ACTIONS,
  EXTERNAL_CAMERA_ACTIONS
} from '../constants';

describe('Constants', () => {
  test('WEBSOCKET_URLS are defined correctly', () => {
    expect(WEBSOCKET_URLS).toBeDefined();
    expect(WEBSOCKET_URLS.LIVE_STREAM).toBe('/video/live-stream');
    expect(WEBSOCKET_URLS.NOTIFICATIONS).toBe('/video/notifications');
    expect(WEBSOCKET_URLS.EXTERNAL_CAMERA).toBe('/video/external-camera-stream');
  });

  test('API_ENDPOINTS are defined correctly', () => {
    expect(API_ENDPOINTS).toBeDefined();
    expect(API_ENDPOINTS.CAMERA_CONFIG).toBe('/video/camera-config');
    expect(API_ENDPOINTS.EXTERNAL_CAMERA_STATUS).toBe('/video/external-camera-status');
    expect(API_ENDPOINTS.NOTIFICATIONS).toBe('/video/notifications');
    expect(API_ENDPOINTS.NOTIFICATIONS_MARK_READ).toBe('/video/notifications/mark-all-read');
  });

  test('WEBSOCKET_STATES are defined correctly', () => {
    expect(WEBSOCKET_STATES).toBeDefined();
    expect(WEBSOCKET_STATES.CONNECTING).toBe(0);
    expect(WEBSOCKET_STATES.OPEN).toBe(1);
    expect(WEBSOCKET_STATES.CLOSING).toBe(2);
    expect(WEBSOCKET_STATES.CLOSED).toBe(3);
  });

  test('STREAM_MODES are defined correctly', () => {
    expect(STREAM_MODES).toBeDefined();
    expect(STREAM_MODES.LIVE).toBe('live');
    expect(STREAM_MODES.VIDEO).toBe('video');
  });

  test('LOG_PREFIXES are defined correctly', () => {
    expect(LOG_PREFIXES).toBeDefined();
    expect(typeof LOG_PREFIXES.INFO).toBe('string');
    expect(typeof LOG_PREFIXES.ERROR).toBe('string');
    expect(typeof LOG_PREFIXES.WARNING).toBe('string');
  });

  test('BEE_STATUS are defined correctly', () => {
    expect(BEE_STATUS).toBeDefined();
    expect(typeof BEE_STATUS.INSIDE).toBe('string');
    expect(typeof BEE_STATUS.OUTSIDE).toBe('string');
  });

  test('CAMERA_STATUS are defined correctly', () => {
    expect(CAMERA_STATUS).toBeDefined();
    expect(typeof CAMERA_STATUS.INACTIVE).toBe('string');
    expect(typeof CAMERA_STATUS.ACTIVE).toBe('string');
    expect(typeof CAMERA_STATUS.ERROR).toBe('string');
    expect(typeof CAMERA_STATUS.STARTING).toBe('string');
  });

  test('NOTIFICATION_TYPES are defined correctly', () => {
    expect(NOTIFICATION_TYPES).toBeDefined();
    expect(typeof NOTIFICATION_TYPES.BEE_NOTIFICATION).toBe('string');
    expect(typeof NOTIFICATION_TYPES.EXTERNAL_CAMERA_CONTROL).toBe('string');
  });

  test('ERROR_TYPES are defined correctly', () => {
    expect(ERROR_TYPES).toBeDefined();
    expect(typeof ERROR_TYPES.CAMERA_NOT_READABLE).toBe('string');
    expect(typeof ERROR_TYPES.CAMERA_NOT_ALLOWED).toBe('string');
    expect(typeof ERROR_TYPES.CAMERA_NOT_FOUND).toBe('string');
  });

  test('ERROR_MESSAGES are defined correctly', () => {
    expect(ERROR_MESSAGES).toBeDefined();
    expect(ERROR_MESSAGES[ERROR_TYPES.CAMERA_NOT_READABLE]).toBeDefined();
    expect(ERROR_MESSAGES[ERROR_TYPES.CAMERA_NOT_ALLOWED]).toBeDefined();
  });

  test('DEFAULT_CONFIG are defined correctly', () => {
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(typeof DEFAULT_CONFIG.FRAME_SEND_INTERVAL).toBe('number');
    expect(typeof DEFAULT_CONFIG.RECONNECT_DELAY).toBe('number');
    expect(typeof DEFAULT_CONFIG.MAX_RETRY_ATTEMPTS).toBe('number');
  });

  test('EVENT_ACTIONS are defined correctly', () => {
    expect(EVENT_ACTIONS).toBeDefined();
    expect(typeof EVENT_ACTIONS.START_EVENT).toBe('string');
    expect(typeof EVENT_ACTIONS.END_EVENT).toBe('string');
  });

  test('EXTERNAL_CAMERA_ACTIONS are defined correctly', () => {
    expect(EXTERNAL_CAMERA_ACTIONS).toBeDefined();
    expect(typeof EXTERNAL_CAMERA_ACTIONS.ACTIVATE).toBe('string');
    expect(typeof EXTERNAL_CAMERA_ACTIONS.DEACTIVATE).toBe('string');
  });

  test('WEBSOCKET_STATE_NAMES are defined correctly', () => {
    expect(WEBSOCKET_STATE_NAMES).toBeDefined();
    expect(WEBSOCKET_STATE_NAMES[0]).toBe('CONNECTING');
    expect(WEBSOCKET_STATE_NAMES[1]).toBe('OPEN');
    expect(WEBSOCKET_STATE_NAMES[2]).toBe('CLOSING');
    expect(WEBSOCKET_STATE_NAMES[3]).toBe('CLOSED');
  });
});