/**
 * @file btree_robot_array.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of interface of array tree.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#ifndef BTREE_ROBOT_ARRAY_H_
#define BTREE_ROBOT_ARRAY_H_

#include "btree_robot_blackboard.h"

/**
 * @brief robot tree size.
 *
 */
#define BTREE_ROBOT_ARRAY_SIZE 8

/**
 * @brief Array containing the nodes of the robot tree.
 *
 */
extern const btree_definition_node_t btree_robot_array[BTREE_ROBOT_ARRAY_SIZE];

/**
 * @brief Externalizes robot tree control structure.
 *
 */
extern btree_definition_tree_data_t btree_robot_control;

#endif /* BTREE_ROBOT_ARRAY_H_ */