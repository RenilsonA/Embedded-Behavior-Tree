/**
 * @file btree_main_blackboard.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Blackboard interface header.
 * @version 1.0
 * @date 10/05/2025
 *
 *
 */

#ifndef BTREE_MAIN_BLACKBOARD_H_
#define BTREE_MAIN_BLACKBOARD_H_

#include "btree_main_common.h"

/**
 * @brief Types of IDs of WiFi.
 *
 */
typedef enum btree_main_blackboard_value_wifi {
    BTREE_MAIN_BLACKBOARD_VALUE_WIFI_UNINITIALIZED = 0,
    BTREE_MAIN_BLACKBOARD_VALUE_WIFI_FAIL,
    BTREE_MAIN_BLACKBOARD_VALUE_WIFI_CONNECTED,
    __BTREE_MAIN_BLACKBOARD_VALUE_WIFI_AMOUNT,
} btree_main_blackboard_value_wifi_t;

/**
 * @brief Values in na blackboard.
 *
 */
typedef enum btree_main_blackboard_value_id {
    BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION = 0,
    __BTREE_MAIN_BLACKBOARD_VALUE_ID_AMOUNT,
} btree_main_blackboard_value_id_t;

/**
 * @brief Buffers in blackboard.
 *
 */
typedef enum btree_main_blackboard_buffer_id {
    BTREE_MAIN_BLACKBOARD_BUFFER_ID_SSID = 0,
    BTREE_MAIN_BLACKBOARD_BUFFER_ID_PASSWORD,
    __BTREE_MAIN_BLACKBOARD_BUFFER_ID_AMOUNT,
} btree_main_blackboard_buffer_id_t;

/**
 * @brief Structure with relevant data from the main tree blackboard .
 *
 */
extern struct btree_main_blackboard btree_main_data;

/**
 * @brief Set specific value from blackboard data in main tree.
 *
 * @param id value id.
 * @param value [in] pointer carrying the value to be saved.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null.
 */
btree_definition_status_t btree_main_blackboard_set_value(
    btree_main_blackboard_value_id_t id, void *value);

/**
 * @brief Get specific value from blackboard data in main tree.
 *
 * @param id value id.
 * @param target [out] value output pointer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null.
 */
btree_definition_status_t btree_main_blackboard_get_value(
    btree_main_blackboard_value_id_t id, void *target);

/**
 * @brief Set specific buffer from blackboard data in main tree.
 *
 * @param id buffer id.
 * @param buffer [in] buffer.
 * @param buffer_size size of buffer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null or size zero.
 */
btree_definition_status_t btree_main_blackboard_set_buffer(
    btree_main_blackboard_buffer_id_t id, uint8_t *buffer, size_t buffer_size);

/**
 * @brief Set specific buffer from blackboard data in main tree.
 *
 * @param id buffer id.
 * @param buffer [out] buffer.
 * @param buffer_size [out] size of buffer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case any pointer null.
 */
btree_definition_status_t btree_main_blackboard_get_buffer(
    btree_main_blackboard_buffer_id_t id, uint8_t *buffer, size_t *buffer_len);

/**
 * @brief Clear all blackboard data from the main tree.
 *
 */
void btree_main_reset_blackboard(void);

#endif /* BTREE_MAIN_BLACKBOARD_H_ */
