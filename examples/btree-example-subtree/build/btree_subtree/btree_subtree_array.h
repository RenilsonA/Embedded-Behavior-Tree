/**
 * @file btree_subtree_array.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of array tree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#ifndef BTREE_SUBTREE_ARRAY_H_
#define BTREE_SUBTREE_ARRAY_H_

#include "btree_subtree_blackboard.h"

/**
 * @brief subtree tree size.
 *
 */
#define BTREE_SUBTREE_ARRAY_SIZE 16

/**
 * @brief Smallest BTREE_DEFINITION_SIZE that holds the subtree tree.
 * The library is built with a single BTREE_DEFINITION_SIZE: use the largest
 * value among all the trees of the firmware.
 *
 */
#define BTREE_SUBTREE_INDEX_SIZE 8

#if BTREE_DEFINITION_SIZE < BTREE_SUBTREE_INDEX_SIZE
#error "The subtree tree has 16 nodes: build with BTREE_DEFINITION_SIZE=8 or more."
#endif

/**
 * @brief Smallest BTREE_DEFINITION_ATTEMPTS_SIZE that holds the counters of the subtree tree.
 * The library is built with a single BTREE_DEFINITION_ATTEMPTS_SIZE: use the
 * largest value among all the trees of the firmware.
 *
 */
#define BTREE_SUBTREE_ATTEMPTS_SIZE 8

#if BTREE_DEFINITION_ATTEMPTS_SIZE < BTREE_SUBTREE_ATTEMPTS_SIZE
#error "The subtree tree has a retry/repeat of 9: build with BTREE_DEFINITION_ATTEMPTS_SIZE=8 or more."
#endif

/**
 * @brief Array containing the nodes of the subtree tree.
 *
 */
extern const btree_definition_node_t btree_subtree_array[BTREE_SUBTREE_ARRAY_SIZE];

/**
 * @brief Externalizes subtree tree control structure.
 *
 */
extern btree_definition_tree_data_t btree_subtree_control;

#endif /* BTREE_SUBTREE_ARRAY_H_ */