/**
 * @file btree_example_array.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of array tree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#ifndef BTREE_EXAMPLE_ARRAY_H_
#define BTREE_EXAMPLE_ARRAY_H_

#include "btree_example_blackboard.h"

/**
 * @brief example tree size.
 *
 */
#define BTREE_EXAMPLE_ARRAY_SIZE 17

/**
 * @brief Smallest BTREE_DEFINITION_SIZE that holds the example tree.
 * The library is built with a single BTREE_DEFINITION_SIZE: use the largest
 * value among all the trees of the firmware.
 *
 */
#define BTREE_EXAMPLE_INDEX_SIZE 8

#if BTREE_DEFINITION_SIZE < BTREE_EXAMPLE_INDEX_SIZE
#error "The example tree has 17 nodes: build with BTREE_DEFINITION_SIZE=8 or more."
#endif

/**
 * @brief Smallest BTREE_DEFINITION_ATTEMPTS_SIZE that holds the counters of the example tree.
 * The library is built with a single BTREE_DEFINITION_ATTEMPTS_SIZE: use the
 * largest value among all the trees of the firmware.
 *
 */
#define BTREE_EXAMPLE_ATTEMPTS_SIZE 8

#if BTREE_DEFINITION_ATTEMPTS_SIZE < BTREE_EXAMPLE_ATTEMPTS_SIZE
#error "The example tree has a retry/repeat of 0: build with BTREE_DEFINITION_ATTEMPTS_SIZE=8 or more."
#endif

/**
 * @brief Array containing the nodes of the example tree.
 *
 */
extern const btree_definition_node_t btree_example_array[BTREE_EXAMPLE_ARRAY_SIZE];

/**
 * @brief Externalizes example tree control structure.
 *
 */
extern btree_definition_tree_data_t btree_example_control;

#endif /* BTREE_EXAMPLE_ARRAY_H_ */