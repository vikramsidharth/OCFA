const admin = require('firebase-admin');
const pool = require('../db');

// Firebase configuration for hosting environments
const firebaseConfig = {
  type: "service_account",
  project_id: "future-soldiers",
  private_key_id: "c892c5b01fcaf1b2e7d0c77d85ae283d6f9f6ce6",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCiPejZWmiPIqst\ngW/pKzxn4shu7aSV7SlrIKNJujahI1HsFwli82OpF5sjWwZ21JuWt5Uo+nrIgaQa\nIEzMCwqzM3qEKIYg24MHsCLnNunqLdmiP/j13z29Z5WtwRgl0Cb6JTy609FPrxF8\nj83+GV1D9NFS57mgdv/6mvXHRZbhle0rV/mCtOVHL8smQ0Y4Z11yrvwfqFrJwvgi\nxXe93Le9Sl1xbhT0wxyaNfall6dKtas0PuJeZzsxldi9JhnMR5BdlCQ3lVdbaCTh\nSR65OkUwJ2x2+cD6kRiWmegsKFaaOaj1i9KR4+QWb5WqnYDSnZPZ6AjF/68ZPVUG\nrun9UopRAgMBAAECggEAHcEC2hG1iUKPaBoL3xQ50MeLgKR+gaxr4ySqLZRD/otO\ns+CJrSb7yP/2SKah6dsV6a8jYM+HAwybftsbmnQP80tmlaQk7RO01Q0daY/tmC/u\ncM4Qp27YkMrVbXczKYQiEdAQcib0hQuTRmfNHGOkchkM5opuxZntWhVfK7t8b0RX\nsEUQ9g75vw8gLEEVPNn9eJnUYtooVQROsiOZ3KlakLWOGw4Uqp7xcjKTF/w0ohe1\nhyQ9X6RraJk5xXZjb6Xv5VUtv32XCK+Exv86+cCOJGxD8Xl6u8YD7fTuJBzZkanz\nWj5MSqcdtW9K1kE0nBBup4jNnVMpvqX/3jaeiTdd7QKBgQDcIrvf2c3KXYvF2dfd\n2OlD27c2FCI+iAmViaSpWwH5TPJoIJ89iXrh0lcK6+FqUznVCpnczocaDxfeCp7A\nGOX8O2nmrudeQ4uxkxb3Unr+ckJUvb60Cx3AiX0XkExk21G194IffmBzffptcbDz\nytr4fsFXlYauFlpWsH6BmAaJhwKBgQC8rJRSKjw+axo6hKUj9ccbr5AAj9NRSf7/\nlotpJL1+pSn/Zg+emRsdmOea1sIWv7bNTiLDfj5r9bpl/XqHundK68OjcDL6WBFT\n1b8YEOYAU2NeyNsHB6xu6AL581DHik5mY7VXd7grglk/tETnkbeECKBwAoNKSTPA\nKJj5EO5jZwKBgC9x+QYlHlqIUPDCo+j3sEbk2xb3ve22SkKFmQy7RbCiqfhRV6De\nubJkMEh1UG8nIubM0x6pEKtIJ3++0Dpc42y6rXd/qPRDIJ+UMTX6+/FNVQiIoMqT\nPsVZnLFwc1algnXys4PwK/+YXloqT9YrmYhHYYpr+swYmz3l6k4qIvaPAoGAcwgx\nggr4IgJAwo7e9JbD53BZts35w+T+kKwjoV5iHlXqzilWupaUfq4b/z6SpTYL6Q6L\niW9t9XqjQ82QqDIay1YFOJ+OpS2OmvOGB9E9udMdkcuaJqYaDqBsOCKODKqZdDm0\ndXirk/NsILfzDtC798ceskwF6gPJho35/ljBT18CgYBzgbGK8rNC/NI2JKF6tkwi\nALVo7ne8h7DJQ2kyDveQ28lqf6uja04Aztpg4CMod1AzSwKCnrvw4Q4GPsbKzrmf\ntuYLMPFsCQcclrDA4OKKaM/Cg29G9M+YXiuPEWrYt6Y1uJFFfmjAAeBppFV0vfZ3\nJqbm9oosxU9Fkd5GZBN6rw==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@future-soldiers.iam.gserviceaccount.com",
  client_id: "101436840634146229001",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40future-soldiers.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin SDK
let firebaseApp;
try {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    projectId: 'future-soldiers'
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    firebaseApp = admin.app();
    console.log('✅ Firebase Admin SDK already initialized');
  } else {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    throw error;
  }
}

/**
 * Send Firebase Cloud Message to a specific user with retry logic
 * @param {number} userId - User Login ID to send notification to
 * @param {Object} message - Message object with title, body, and data
 * @param {number} retryCount - Number of retries attempted
 * @returns {Promise<Object>} - FCM response
 */
async function sendFirebaseNotification(userId, message, retryCount = 0) {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK not initialized');
  }

  const maxRetries = 3;
  const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

  try {
    // Get user's FCM token from database
    const userResult = await pool.query(
      'SELECT fcm_token, expo_token, username, role, unit FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const user = userResult.rows[0];
    
    if (!user.fcm_token && !user.expo_token) {
      throw new Error(`No push tokens found for user ${userId}`);
    }

    const responses = [];
    let hasSuccessfulDelivery = false;

    // Send FCM notification if token exists
    if (user.fcm_token) {
      try {
        const fcmMessage = {
          token: user.fcm_token,
          notification: {
            title: message.title,
            body: message.body
          },
          data: {
            ...message.data,
            userId: userId.toString(),
            username: user.username,
            role: user.role,
            unit: user.unit || '',
            timestamp: new Date().toISOString(),
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: getChannelId(message.data?.type),
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true,
              icon: 'ic_notification',
              color: getNotificationColor(message.data?.type),
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              tag: message.data?.alertId || 'default'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                category: message.data?.type || 'default',
                'mutable-content': 1
              }
            },
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert'
            }
          },
          webpush: {
            headers: {
              Urgency: 'high'
            },
            notification: {
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
              tag: message.data?.alertId || 'default',
              requireInteraction: message.data?.type === 'emergency'
            }
          }
        };

        const response = await admin.messaging().send(fcmMessage);
        responses.push({ type: 'fcm', success: true, messageId: response });
        hasSuccessfulDelivery = true;
        
        // Log successful delivery
        await logNotificationDelivery(userId, 'fcm', 'delivered', response);
        console.log(`✅ FCM notification sent successfully to user ${userId} (${user.username})`);
        
      } catch (fcmError) {
        console.error(`❌ FCM notification failed for user ${userId}:`, fcmError.message);
        responses.push({ type: 'fcm', success: false, error: fcmError.message });
        
        // Log failed delivery
        await logNotificationDelivery(userId, 'fcm', 'failed', null, fcmError.message);
        
        // Retry logic for specific FCM errors
        if (retryCount < maxRetries && shouldRetryFCMError(fcmError)) {
          console.log(`🔄 Retrying FCM notification for user ${userId} (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return sendFirebaseNotification(userId, message, retryCount + 1);
        }
      }
    }

    // Send Expo notification if token exists (as backup)
    if (user.expo_token) {
      try {
        const expoResponse = await sendExpoNotification(user.expo_token, message);
        responses.push({ type: 'expo', success: true, messageId: expoResponse });
        hasSuccessfulDelivery = true;
        
        // Log successful delivery
        await logNotificationDelivery(userId, 'expo', 'delivered', expoResponse);
        console.log(`✅ Expo notification sent successfully to user ${userId} (${user.username})`);
        
      } catch (expoError) {
        console.error(`❌ Expo notification failed for user ${userId}:`, expoError.message);
        responses.push({ type: 'expo', success: false, error: expoError.message });
        
        // Log failed delivery
        await logNotificationDelivery(userId, 'expo', 'failed', null, expoError.message);
      }
    }

    return {
      userId,
      username: user.username,
      unit: user.unit,
      responses,
      success: hasSuccessfulDelivery,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Error sending notification to user ${userId}:`, error.message);
    
    // Retry logic for general errors
    if (retryCount < maxRetries && shouldRetryGeneralError(error)) {
      console.log(`🔄 Retrying notification for user ${userId} (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return sendFirebaseNotification(userId, message, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Send notification to multiple users with rate limiting
 * @param {Array<number>} userIds - Array of User Login IDs
 * @param {Object} message - Message object
 * @param {number} rateLimit - Number of notifications per second (default: 100)
 * @returns {Promise<Array>} - Array of results
 */
async function sendBulkFirebaseNotifications(userIds, message, rateLimit = 100) {
  const results = [];
  const batchSize = Math.ceil(rateLimit / 10); // Process in smaller batches
  const delayBetweenBatches = 1000 / (rateLimit / batchSize); // Calculate delay
  
  console.log(`📤 Starting bulk notification send to ${userIds.length} users`);
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchPromises = batch.map(async (userId) => {
      try {
        const result = await sendFirebaseNotification(userId, message);
        return result;
      } catch (error) {
        return {
          userId,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Rate limiting delay between batches
    if (i + batchSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  console.log(`📊 Bulk notification complete: ${successCount} successful, ${failureCount} failed out of ${userIds.length} total`);
  
  return results;
}

/**
 * Send notification to users by role or unit with smart targeting
 * @param {Object} filters - Filters for users (role, unit, etc.)
 * @param {Object} message - Message object
 * @returns {Promise<Object>} - Array of results
 */
async function sendNotificationsByFilter(filters, message) {
  try {
    let query = 'SELECT id, username, role, unit FROM users WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (filters.role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(filters.role);
    }

    if (filters.unit) {
      paramCount++;
      query += ` AND unit = $${paramCount}`;
      params.push(filters.unit);
    }

    if (filters.hasPushToken) {
      query += ' AND (fcm_token IS NOT NULL OR expo_token IS NOT NULL)';
    }

    // Add active user filter
    query += ' AND last_active > NOW() - INTERVAL \'24 hours\'';

    const result = await pool.query(query, params);
    const userIds = result.rows.map(row => row.id);
    
    if (userIds.length === 0) {
      return { message: 'No users found matching criteria', count: 0, results: [] };
    }

    console.log(`🎯 Sending notifications to ${userIds.length} users matching filters:`, filters);
    const results = await sendBulkFirebaseNotifications(userIds, message);
    
    return {
      message: `Sent notifications to ${userIds.length} users`,
      count: userIds.length,
      results,
      filters
    };

  } catch (error) {
    console.error('❌ Error sending notifications by filter:', error);
    throw error;
  }
}

/**
 * Send zone breach alert with enhanced targeting
 * @param {Object} breachData - Zone breach data
 * @returns {Promise<Object>} - Result
 */
async function sendZoneBreachAlert(breachData) {
  const { zoneId, userId, breachType, latitude, longitude } = breachData;
  
  try {
    // Get zone information
    const zoneResult = await pool.query(
      'SELECT name, zone_type, unit FROM zones WHERE id = $1',
      [zoneId]
    );
    
    if (zoneResult.rows.length === 0) {
      throw new Error('Zone not found');
    }
    
    const zone = zoneResult.rows[0];
    
    // Get user information
    const userResult = await pool.query(
      'SELECT username, role, unit FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Create alert message with enhanced data
    const message = {
      title: `🚫 Zone Breach Alert - ${zone.name}`,
      body: `${user.username} has ${breachType} ${zone.name} (${zone.zone_type})`,
      data: {
        type: 'zone-breach',
        category: 'zone',
        priority: 'high',
        zoneId: zoneId.toString(),
        userId: userId.toString(),
        breachType,
        zoneName: zone.name,
        zoneType: zone.zone_type,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        username: user.username,
        userRole: user.role,
        userUnit: user.unit,
        alertId: `zone-breach-${zoneId}-${Date.now()}`,
        requiresAction: true
      }
    };
    
    // Enhanced targeting: notify commanders, supervisors, and security personnel
    const commandersResult = await pool.query(
      `SELECT id FROM users 
       WHERE role IN ('commander', 'supervisor', 'security') 
       AND unit = $1 
       AND id != $2 
       AND (fcm_token IS NOT NULL OR expo_token IS NOT NULL)
       AND last_active > NOW() - INTERVAL '24 hours'`,
      [user.unit, userId]
    );
    
    const commanderIds = commandersResult.rows.map(row => row.id);
    
    if (commanderIds.length > 0) {
      const results = await sendBulkFirebaseNotifications(commanderIds, message);
      
      // Create alert record in database
      await pool.query(
        `INSERT INTO alerts (category, message, severity, status, user_id, unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['zone_breach', message.body, 'high', 'active', userId, user.unit]
      );
      
      console.log(`🚨 Zone breach alert sent to ${commanderIds.length} commanders/supervisors`);
      
      return {
        message: 'Zone breach alert sent successfully',
        sentTo: commanderIds.length,
        results,
        zone: zone.name,
        breachType
      };
    } else {
      return {
        message: 'No commanders found to notify',
        sentTo: 0,
        zone: zone.name,
        breachType
      };
    }
    
  } catch (error) {
    console.error('❌ Error sending zone breach alert:', error);
    throw error;
  }
}

/**
 * Send emergency alert with priority handling
 * @param {Object} emergencyData - Emergency data
 * @returns {Promise<Object>} - Result
 */
async function sendEmergencyAlert(emergencyData) {
  const { title, message, severity, affectedUnits, affectedUsers, latitude, longitude, createdBy } = emergencyData;
  
  try {
    const alertMessage = {
      title: `🚨 EMERGENCY: ${title}`,
      body: message,
      data: {
        type: 'emergency',
        category: 'emergency',
        priority: severity === 'critical' ? 'urgent' : 'high',
        severity,
        affectedUnits,
        affectedUsers,
        latitude: latitude?.toString(),
        longitude: longitude?.toString(),
        emergencyLevel: severity,
        alertId: `emergency-${Date.now()}`,
        requiresImmediateAction: severity === 'critical',
        sound: 'emergency'
      }
    };
    
    let userIds = [];
    
    // If specific users are affected, notify them
    if (affectedUsers && affectedUsers.length > 0) {
      userIds = [...affectedUsers];
    }
    
    // If specific units are affected, notify all users in those units
    if (affectedUnits && affectedUnits.length > 0) {
      const unitsResult = await pool.query(
        `SELECT id FROM users 
         WHERE unit = ANY($1) 
         AND (fcm_token IS NOT NULL OR expo_token IS NOT NULL)
         AND last_active > NOW() - INTERVAL '24 hours'`,
        [affectedUnits]
      );
      const unitUserIds = unitsResult.rows.map(row => row.id);
      userIds = [...new Set([...userIds, ...unitUserIds])];
    }
    
    // If no specific users/units, notify all commanders and supervisors
    if (userIds.length === 0) {
      const commandersResult = await pool.query(
        `SELECT id FROM users 
         WHERE role IN ('commander', 'supervisor') 
         AND (fcm_token IS NOT NULL OR expo_token IS NOT NULL)
         AND last_active > NOW() - INTERVAL '24 hours'`
      );
      userIds = commandersResult.rows.map(row => row.id);
    }
    
    // Remove the creator from recipients
    userIds = userIds.filter(id => id !== createdBy);
    
    if (userIds.length > 0) {
      // For critical emergencies, send immediately without rate limiting
      const rateLimit = severity === 'critical' ? 1000 : 100;
      const results = await sendBulkFirebaseNotifications(userIds, alertMessage, rateLimit);
      
      // Create alert record
      await pool.query(
        `INSERT INTO alerts (category, message, severity, status, user_id, unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['emergency', title, severity, 'active', createdBy, null]
      );
      
      console.log(`🚨 Emergency alert sent to ${userIds.length} recipients (severity: ${severity})`);
      
      return {
        message: 'Emergency alert sent successfully',
        sentTo: userIds.length,
        severity,
        results
      };
    } else {
      return {
        message: 'No recipients found for emergency alert',
        sentTo: 0,
        severity
      };
    }
    
  } catch (error) {
    console.error('❌ Error sending emergency alert:', error);
    throw error;
  }
}

/**
 * Send assignment notification with enhanced metadata
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<Object>} - Result
 */
async function sendAssignmentNotification(assignmentData) {
  const { assignmentId, assignedTo, title, description, priority, dueDate } = assignmentData;
  
  try {
    const message = {
      title: `📋 New Assignment: ${title}`,
      body: description || 'You have been assigned a new task',
      data: {
        type: 'assignment',
        category: 'assignment',
        priority: priority === 'urgent' ? 'high' : 'normal',
        assignmentId: assignmentId.toString(),
        title,
        description,
        priority,
        dueDate,
        dueDateFormatted: dueDate ? new Date(dueDate).toLocaleDateString() : null,
        alertId: `assignment-${assignmentId}`,
        requiresAction: true
      }
    };
    
    const result = await sendFirebaseNotification(assignedTo, message);
    
    // Create notification record
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, category, priority, source, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [assignedTo, message.title, message.body, 'assignment', 'assignment', priority, 'system', message.data]
    );
    
    console.log(`📋 Assignment notification sent to user ${assignedTo}`);
    
    return {
      message: 'Assignment notification sent successfully',
      result
    };
    
  } catch (error) {
    console.error('❌ Error sending assignment notification:', error);
    throw error;
  }
}

// Helper functions
function getChannelId(type) {
  switch (type) {
    case 'zone-breach':
      return 'zone-breach';
    case 'emergency':
      return 'emergency';
    case 'assignment':
      return 'assignment';
    default:
      return 'default';
  }
}

function getNotificationColor(type) {
  switch (type) {
    case 'zone-breach':
      return '#FF0000';
    case 'emergency':
      return '#FF0000';
    case 'assignment':
      return '#FFA500';
    default:
      return '#2196F3';
  }
}

function shouldRetryFCMError(error) {
  // Retry on network errors, rate limits, and temporary failures
  const retryableErrors = [
    'messaging/unavailable',
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/quota-exceeded',
    'messaging/network-error'
  ];
  
  return retryableErrors.some(errCode => error.code === errCode);
}

function shouldRetryGeneralError(error) {
  // Retry on database connection issues and network errors
  return error.code === 'ECONNRESET' || 
         error.code === 'ENOTFOUND' || 
         error.message.includes('timeout');
}

async function logNotificationDelivery(userId, method, status, messageId, errorMessage) {
  try {
    await pool.query(
      `INSERT INTO notification_delivery_log (user_id, delivery_method, delivery_status, fcm_message_id, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, method, status, messageId, errorMessage]
    );
  } catch (error) {
    console.error('Failed to log notification delivery:', error);
  }
}

// Expo notification fallback with enhanced error handling
async function sendExpoNotification(expoToken, message) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate'
      },
      body: JSON.stringify({
        to: expoToken,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: message.data?.sound || 'default',
        priority: message.data?.priority === 'urgent' ? 'high' : 'default',
        channelId: getChannelId(message.data?.type),
        badge: 1,
        _displayInForeground: true
      }),
    });
    
    const result = await response.json();
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data?.id || 'expo-sent';
  } catch (error) {
    throw new Error(`Expo notification failed: ${error.message}`);
  }
}

module.exports = {
  sendFirebaseNotification,
  sendBulkFirebaseNotifications,
  sendNotificationsByFilter,
  sendZoneBreachAlert,
  sendEmergencyAlert,
  sendAssignmentNotification
};

// Topic utilities (no DB storage required)
/**
 * Subscribe an FCM device token to a topic
 */
async function subscribeTokenToTopic(fcmToken, topic) {
  if (!firebaseApp) throw new Error('Firebase Admin SDK not initialized');
  if (!fcmToken) throw new Error('Missing fcmToken');
  if (!topic) throw new Error('Missing topic');
  
  const normalized = topic.replace(/[^a-zA-Z0-9-_.~%]/g, '-').toLowerCase();
  const res = await admin.messaging().subscribeToTopic([fcmToken], normalized);
  return { topic: normalized, res };
}

/**
 * Unsubscribe an FCM device token from a topic
 */
async function unsubscribeTokenFromTopic(fcmToken, topic) {
  if (!firebaseApp) throw new Error('Firebase Admin SDK not initialized');
  if (!fcmToken) throw new Error('Missing fcmToken');
  if (!topic) throw new Error('Missing topic');
  const normalized = topic.replace(/[^a-zA-Z0-9-_.~%]/g, '-').toLowerCase();
  const res = await admin.messaging().unsubscribeFromTopic([fcmToken], normalized);
  return { topic: normalized, res };
}

/**
 * Send a notification to an FCM topic
 */
async function sendTopicNotification(topic, message) {
  if (!firebaseApp) throw new Error('Firebase Admin SDK not initialized');
  const normalized = topic.replace(/[^a-zA-Z0-9-_.~%]/g, '-').toLowerCase();
  const msg = {
    topic: normalized,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      ...(message.data || {}),
      topic: normalized,
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: getChannelId(message.data?.type),
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        icon: 'ic_notification',
        color: getNotificationColor(message.data?.type),
      },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };
  const response = await admin.messaging().send(msg);
  return { topic: normalized, messageId: response };
}

module.exports.subscribeTokenToTopic = subscribeTokenToTopic;
module.exports.unsubscribeTokenFromTopic = unsubscribeTokenFromTopic;
module.exports.sendTopicNotification = sendTopicNotification;
