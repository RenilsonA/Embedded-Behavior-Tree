/**
 * @file btree_robot_common.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of interface of the common variables of the robot.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#ifndef BTREE_ROBOT_COMMON_H_
#define BTREE_ROBOT_COMMON_H_

#include "btree_definition.h"

/**
 * @brief Size of array nodes status.
 *
 */
#define BTREE_ROBOT_COMMON_STATUS_NODES_SIZE (btree_index_t) 1

/**
 * @brief Number of fields needed in the worst case scenario of tree robot attempted fields.
 * At least 1: ISO C does not allow zero-length arrays.
 *
 */
#define BTREE_ROBOT_COMMON_ATTEMPTS_SIZE 1

/**
 * @brief Externalize array of tree robot attemps.
 *
 */
extern uint32_t btree_robot_status_nodes[BTREE_ROBOT_COMMON_STATUS_NODES_SIZE];

/**
 * @brief Externalize array of tree robot attemps.
 *
 */
extern uint32_t btree_robot_common_attempts[BTREE_ROBOT_COMMON_ATTEMPTS_SIZE];

#endif /* BTREE_ROBOT_COMMON_H_ */