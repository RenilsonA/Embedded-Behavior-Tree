/**
 * @file btree_robot_common.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Interface of the common variables of the robot.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#include "btree_robot_common.h"

/**
 * @brief Nodes states. Each value, carry 16 nodes status. Each node status is 2 bits.
 *
 */
uint32_t btree_robot_status_nodes[BTREE_ROBOT_COMMON_STATUS_NODES_SIZE] = {0};

/**
 * @brief Fields to input tries or attempts.
 *
 */
uint32_t btree_robot_common_attempts[BTREE_ROBOT_COMMON_ATTEMPTS_SIZE] = {0};

