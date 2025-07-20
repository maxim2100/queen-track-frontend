import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import { SettingsApiService } from '../services';

const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [presets, setPresets] = useState({});

  // Load current settings on component mount
  useEffect(() => {
    loadSettings();
    loadPresets();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await SettingsApiService.getSettings();
      if (data.status === 'success') {
        setSettings(data.settings);
      }
    } catch (error) {
      // console.error('Failed to load settings:', error);
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await SettingsApiService.getPresets();
      if (data.status === 'success') {
        setPresets(data.presets);
      }
    } catch (error) {
      // console.error('Failed to load presets:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const data = await SettingsApiService.updateSettings(settings);
      
      if (data.status === 'success') {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to save settings');
      }
    } catch (error) {
      // console.error('Failed to save settings:', error);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      const data = await SettingsApiService.resetSettings();
      
      if (data.status === 'success') {
        setSettings(data.settings);
        setMessage('Settings reset to defaults!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      // console.error('Failed to reset settings:', error);
      setMessage('Failed to reset settings');
    }
  };

  const applyPreset = async (presetName) => {
    try {
      const data = await SettingsApiService.applyPreset(presetName);
      
      if (data.status === 'success') {
        setSettings(data.settings);
        setMessage(`Applied ${presetName} preset!`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      // console.error('Failed to apply preset:', error);
      setMessage('Failed to apply preset');
    }
  };

  const updateProcessingSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      processing: {
        ...prev.processing,
        [key]: value
      }
    }));
  };

  const updateCameraSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      camera_config: {
        ...prev.camera_config,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-page">
        <div className="error">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>🛠️ System Settings</h1>
        <p>Configure image processing, drawing options, and video management settings</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Quick Presets */}
      <div className="settings-section">
        <h2>📋 Quick Presets</h2>
        <div className="presets-grid">
          {Object.keys(presets).map(presetName => (
            <button
              key={presetName}
              className="preset-button"
              onClick={() => applyPreset(presetName)}
            >
              {presetName.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Detection & Classification Settings */}
      <div className="settings-section">
        <h2>🔍 Detection & Classification</h2>
        <div className="settings-grid">
          <div className="setting-item" data-type="detection">
            <label>
              <input
                type="checkbox"
                checked={settings.processing.detection_enabled}
                onChange={(e) => updateProcessingSetting('detection_enabled', e.target.checked)}
              />
              Enable YOLO Detection
            </label>
          </div>
          
          <div className="setting-item" data-type="detection">
            <label>
              <input
                type="checkbox"
                checked={settings.processing.classification_enabled}
                onChange={(e) => updateProcessingSetting('classification_enabled', e.target.checked)}
              />
              Enable Classification
            </label>
          </div>

          <div className="setting-item" data-type="detection">
            <label>
              <input
                type="checkbox"
                checked={settings.processing.computer_vision_fallback}
                onChange={(e) => updateProcessingSetting('computer_vision_fallback', e.target.checked)}
              />
              Computer Vision Fallback
            </label>
          </div>

          <div className="setting-item" data-type="detection">
            <label>
              Detection Confidence Threshold: {settings.processing.detection_confidence_threshold}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.processing.detection_confidence_threshold}
              onChange={(e) => updateProcessingSetting('detection_confidence_threshold', parseFloat(e.target.value))}
            />
          </div>

          <div className="setting-item" data-type="detection">
            <label>
              Classification Confidence Threshold: {settings.processing.classification_confidence_threshold}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.processing.classification_confidence_threshold}
              onChange={(e) => updateProcessingSetting('classification_confidence_threshold', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Drawing Settings */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2>🎨 Drawing & Visual Elements</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_bee_path}
              onChange={(e) => updateProcessingSetting('draw_bee_path', e.target.checked)}
            />
            Draw Bee Path
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_center_line}
              onChange={(e) => updateProcessingSetting('draw_center_line', e.target.checked)}
            />
            Draw Center Line
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_roi_box}
              onChange={(e) => updateProcessingSetting('draw_roi_box', e.target.checked)}
            />
            Draw ROI Box
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_status_text}
              onChange={(e) => updateProcessingSetting('draw_status_text', e.target.checked)}
            />
            Draw Status Text (Inside/Outside)
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_confidence_scores}
              onChange={(e) => updateProcessingSetting('draw_confidence_scores', e.target.checked)}
            />
            Draw Confidence Scores
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_timestamp}
              onChange={(e) => updateProcessingSetting('draw_timestamp', e.target.checked)}
            />
            Draw Timestamp
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.draw_frame_counter}
              onChange={(e) => updateProcessingSetting('draw_frame_counter', e.target.checked)}
            />
            Draw Frame Counter
          </label>
        </div>
      </div>

      {/* ROI Settings */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2>📐 Region of Interest (ROI)</h2>
        
        {/* ROI Visual */}
        <div style={{marginBottom: '20px', display: 'flex', justifyContent: 'center'}}>
          <div style={{
            position: 'relative',
            width: '320px', // 1280 / 4
            height: '180px', // 720 / 4
            backgroundColor: 'white',
            border: '2px solid #333',
            borderRadius: '4px'
          }}>
            {/* Current ROI (black) */}
            <div style={{
              position: 'absolute',
              left: `${(settings.processing.roi_x_min / 1280) * 320}px`,
              top: `${(settings.processing.roi_y_min / 720) * 180}px`,
              width: `${((settings.processing.roi_x_max - settings.processing.roi_x_min) / 1280) * 320}px`,
              height: `${((settings.processing.roi_y_max - settings.processing.roi_y_min) / 720) * 180}px`,
              border: '2px solid black',
              backgroundColor: 'rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                fontSize: '10px',
                color: 'black',
                padding: '2px',
                fontWeight: 'bold'
              }}>
                Current ROI
              </div>
            </div>
            
            {/* Coordinates text */}
            <div style={{
              position: 'absolute',
              top: '-25px',
              left: '0',
              fontSize: '12px',
              color: '#666'
            }}>
              (0,0)
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-25px',
              right: '0',
              fontSize: '12px',
              color: '#666'
            }}>
              (1280,720)
            </div>
          </div>
        </div>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>
              X Min: {settings.processing.roi_x_min}
            </label>
            <input
              type="range"
              min="0"
              max="1280"
              value={settings.processing.roi_x_min}
              onChange={(e) => updateProcessingSetting('roi_x_min', parseInt(e.target.value))}
              style={{width: '100%'}}
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>
              Y Min: {settings.processing.roi_y_min}
            </label>
            <input
              type="range"
              min="0"
              max="720"
              value={settings.processing.roi_y_min}
              onChange={(e) => updateProcessingSetting('roi_y_min', parseInt(e.target.value))}
              style={{width: '100%'}}
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>
              X Max: {settings.processing.roi_x_max}
            </label>
            <input
              type="range"
              min="0"
              max="1280"
              value={settings.processing.roi_x_max}
              onChange={(e) => updateProcessingSetting('roi_x_max', parseInt(e.target.value))}
              style={{width: '100%'}}
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>
              Y Max: {settings.processing.roi_y_max}
            </label>
            <input
              type="range"
              min="0"
              max="720"
              value={settings.processing.roi_y_max}
              onChange={(e) => updateProcessingSetting('roi_y_max', parseInt(e.target.value))}
              style={{width: '100%'}}
            />
          </div>
        </div>
        <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          <p>ROI: ({settings.processing.roi_x_min}, {settings.processing.roi_y_min}) to ({settings.processing.roi_x_max}, {settings.processing.roi_y_max})</p>
          <p>Size: {settings.processing.roi_x_max - settings.processing.roi_x_min} × {settings.processing.roi_y_max - settings.processing.roi_y_min} pixels</p>
        </div>
      </div>

      {/* Video Management */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2>🎥 Video Management</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.auto_delete_videos_after_session}
              onChange={(e) => updateProcessingSetting('auto_delete_videos_after_session', e.target.checked)}
            />
            Auto-delete videos after session ends
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.keep_original_videos}
              onChange={(e) => updateProcessingSetting('keep_original_videos', e.target.checked)}
            />
            Keep original videos (before conversion)
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.auto_convert_videos}
              onChange={(e) => updateProcessingSetting('auto_convert_videos', e.target.checked)}
            />
            Auto-convert videos to browser format
          </label>

          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>
              Video Buffer (seconds): {settings.processing.video_buffer_seconds}
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={settings.processing.video_buffer_seconds}
              onChange={(e) => updateProcessingSetting('video_buffer_seconds', parseInt(e.target.value))}
              style={{width: '100%'}}
            />
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2>📧 Email Notifications</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.email_notifications_enabled}
              onChange={(e) => updateProcessingSetting('email_notifications_enabled', e.target.checked)}
            />
            Enable Email Notifications
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.email_on_exit}
              onChange={(e) => updateProcessingSetting('email_on_exit', e.target.checked)}
              disabled={!settings.processing.email_notifications_enabled}
            />
            Email on Bee Exit
          </label>

          <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <input
              type="checkbox"
              checked={settings.processing.email_on_entrance}
              onChange={(e) => updateProcessingSetting('email_on_entrance', e.target.checked)}
              disabled={!settings.processing.email_notifications_enabled}
            />
            Email on Bee Entrance
          </label>

          <div style={{gridColumn: 'span 2'}}>
            <label style={{display: 'block', marginBottom: '5px'}}>
              הודעות מייל יישלחו לכתובת:
            </label>
            <input
              type="email"
              value={settings.processing.notification_email || ''}
              onChange={(e) => updateProcessingSetting('notification_email', e.target.value)}
              placeholder="example@gmail.com"
              disabled={!settings.processing.email_notifications_enabled}
              style={{
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                opacity: settings.processing.email_notifications_enabled ? 1 : 0.6
              }}
            />
            {!settings.processing.notification_email && settings.processing.email_notifications_enabled && (
              <small style={{color: '#ff6600', fontSize: '12px'}}>
                * יש להגדיר כתובת מייל כדי לקבל התרעות
              </small>
            )}
          </div>
        </div>
      </div>

      {/* Camera Configuration */}
      <div style={{marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2>📹 Camera Configuration</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>Internal Camera ID:</label>
            <input
              type="text"
              value={settings.camera_config.internal_camera_id}
              onChange={(e) => updateCameraSetting('internal_camera_id', e.target.value)}
              placeholder="0"
              style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
            />
          </div>

          <div>
            <label style={{display: 'block', marginBottom: '5px'}}>External Camera ID:</label>
            <input
              type="text"
              value={settings.camera_config.external_camera_id}
              onChange={(e) => updateCameraSetting('external_camera_id', e.target.value)}
              placeholder="1"
              style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <button 
          className="save-button"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
        
        <button 
          className="reset-button"
          onClick={resetSettings}
        >
          🔄 Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPage; 