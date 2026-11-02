/**
 * @file btree_subtree_subtree.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of subtree tree.
 * @version 1.0
 * @date 12/05/2025
 *
 */

#ifndef BTREE_SUBTREE_SUBTREE_H_
#define BTREE_SUBTREE_SUBTREE_H_

#include "btree_subtree_blackboard.h"

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_subtree_subtree_condition1(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action1(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_subtree_subtree_condition2(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action2(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_subtree_subtree_condition3(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action3(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action4(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action5(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_subtree_subtree_action6(void);

#endif /* BTREE_SUBTREE_SUBTREE_H_ */