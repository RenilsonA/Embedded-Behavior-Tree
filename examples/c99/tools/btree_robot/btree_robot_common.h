/**
 * @file btree_robot_common.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of the common variables of the robot.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#ifndef BTREE_ROBOT_COMMON_H_
#define BTREE_ROBOT_COMMON_H_

#include "btree_definition.h"

/**
 * @brief Number of counters used by the retry and repeat nodes of tree robot.
 *
 */
#define BTREE_ROBOT_COMMON_ATTEMPTS_SIZE 1

/**
 * @brief Externalize array of tree robot attempts.
 *
 */
extern btree_definition_attempts_t btree_robot_common_attempts[BTREE_ROBOT_COMMON_ATTEMPTS_SIZE];

#endif /* BTREE_ROBOT_COMMON_H_ */