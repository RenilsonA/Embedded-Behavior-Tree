/**
 * @file btree_main_array.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of array tree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#ifndef BTREE_MAIN_ARRAY_H_
#define BTREE_MAIN_ARRAY_H_

#include "btree_main_blackboard.h"

/**
 * @brief main tree size.
 *
 */
#define BTREE_MAIN_ARRAY_SIZE 240

/**
 * @brief Smallest BTREE_DEFINITION_SIZE that holds the main tree.
 * The library is built with a single BTREE_DEFINITION_SIZE: use the largest
 * value among all the trees of the firmware.
 *
 */
#define BTREE_MAIN_INDEX_SIZE 8

#if BTREE_DEFINITION_SIZE < BTREE_MAIN_INDEX_SIZE
#error "The main tree has 240 nodes: build with BTREE_DEFINITION_SIZE=8 or more."
#endif

/**
 * @brief Smallest BTREE_DEFINITION_ATTEMPTS_SIZE that holds the counters of the main tree.
 * The library is built with a single BTREE_DEFINITION_ATTEMPTS_SIZE: use the
 * largest value among all the trees of the firmware.
 *
 */
#define BTREE_MAIN_ATTEMPTS_SIZE 8

#if BTREE_DEFINITION_ATTEMPTS_SIZE < BTREE_MAIN_ATTEMPTS_SIZE
#error "The main tree has a retry/repeat of 0: build with BTREE_DEFINITION_ATTEMPTS_SIZE=8 or more."
#endif

/**
 * @brief Array containing the nodes of the main tree.
 *
 */
extern const btree_definition_node_t btree_main_array[BTREE_MAIN_ARRAY_SIZE];

/**
 * @brief Externalizes main tree control structure.
 *
 */
extern btree_definition_tree_data_t btree_main_control;

#endif /* BTREE_MAIN_ARRAY_H_ */