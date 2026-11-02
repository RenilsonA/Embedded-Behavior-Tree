/**
 * @file btree_example_blackboard.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Blackboard interface header.
 * @version 1.0
 * @date 12/05/2025
 *
 *
 */

#ifndef BTREE_EXAMPLE_BLACKBOARD_H_
#define BTREE_EXAMPLE_BLACKBOARD_H_

#include "btree_example_common.h"

/**
 * @brief Values in na blackboard.
 *
 */
typedef enum btree_example_blackboard_value_id {
    __BTREE_EXAMPLE_BLACKBOARD_VALUE_ID_AMOUNT,
} btree_example_blackboard_value_id_t;

/**
 * @brief Buffers in blackboard.
 *
 */
typedef enum btree_example_blackboard_buffer_id {
    __BTREE_EXAMPLE_BLACKBOARD_BUFFER_ID_AMOUNT,
} btree_example_blackboard_buffer_id_t;

/**
 * @brief Structure with relevant data from the example tree blackboard .
 *
 */
extern struct btree_example_blackboard btree_example_data;

/**
 * @brief Set specific value from blackboard data in example tree.
 *
 * @param id value id.
 * @param value [in] pointer carrying the value to be saved.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null.
 */
btree_definition_status_t btree_example_blackboard_set_value(
    btree_example_blackboard_value_id_t id, void *value);

/**
 * @brief Get specific value from blackboard data in example tree.
 *
 * @param id value id.
 * @param target [out] value output pointer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null.
 */
btree_definition_status_t btree_example_blackboard_get_value(
    btree_example_blackboard_value_id_t id, void *target);

/**
 * @brief Set specific buffer from blackboard data in example tree.
 *
 * @param id buffer id.
 * @param buffer [in] buffer.
 * @param buffer_size size of buffer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case pointer null or size zero.
 */
btree_definition_status_t btree_example_blackboard_set_buffer(
    btree_example_blackboard_buffer_id_t id, uint8_t *buffer, size_t buffer_size);

/**
 * @brief Set specific buffer from blackboard data in example tree.
 *
 * @param id buffer id.
 * @param buffer [out] buffer.
 * @param buffer_size [out] size of buffer.
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success.
 * @retval BTREE_DEFINITION_STATUS_FAIL case any pointer null.
 */
btree_definition_status_t btree_example_blackboard_get_buffer(
    btree_example_blackboard_buffer_id_t id, uint8_t *buffer, size_t *buffer_len);

/**
 * @brief Clear all blackboard data from the example tree.
 *
 */
void btree_example_reset_blackboard(void);

#endif /* BTREE_EXAMPLE_BLACKBOARD_H_ */
