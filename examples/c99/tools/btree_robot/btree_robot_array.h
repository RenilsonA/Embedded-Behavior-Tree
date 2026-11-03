/**
 * @file btree_robot_array.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of array tree.
 * @version 1.0
 * @date 02/11/2026
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
 * @brief Smallest BTREE_DEFINITION_SIZE that holds the robot tree.
 * The library is built with a single BTREE_DEFINITION_SIZE: use the largest
 * value among all the trees of the firmware.
 *
 */
#define BTREE_ROBOT_INDEX_SIZE 8

#if BTREE_DEFINITION_SIZE < BTREE_ROBOT_INDEX_SIZE
#error "The robot tree has 8 nodes: build with BTREE_DEFINITION_SIZE=8 or more."
#endif

/**
 * @brief Smallest BTREE_DEFINITION_ATTEMPTS_SIZE that holds the counters of the robot tree.
 * The library is built with a single BTREE_DEFINITION_ATTEMPTS_SIZE: use the
 * largest value among all the trees of the firmware.
 *
 */
#define BTREE_ROBOT_ATTEMPTS_SIZE 8

#if BTREE_DEFINITION_ATTEMPTS_SIZE < BTREE_ROBOT_ATTEMPTS_SIZE
#error "The robot tree has a retry/repeat of 3: build with BTREE_DEFINITION_ATTEMPTS_SIZE=8 or more."
#endif

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