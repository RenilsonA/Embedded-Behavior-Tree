/**
 * @file btree_subtree_common.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of the common variables of the subtree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#ifndef BTREE_SUBTREE_COMMON_H_
#define BTREE_SUBTREE_COMMON_H_

#include "btree_definition.h"

/**
 * @brief Number of counters used by the retry and repeat nodes of tree subtree.
 *
 */
#define BTREE_SUBTREE_COMMON_ATTEMPTS_SIZE 2

/**
 * @brief Externalize array of tree subtree attempts.
 *
 */
extern btree_definition_attempts_t btree_subtree_common_attempts[BTREE_SUBTREE_COMMON_ATTEMPTS_SIZE];

#endif /* BTREE_SUBTREE_COMMON_H_ */