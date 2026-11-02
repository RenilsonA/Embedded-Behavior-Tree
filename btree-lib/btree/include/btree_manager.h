/**
 * @file btree_manager.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of behavior tree manager.
 * @version 1.0
 * @date 26/06/24
 *
 * @copyright Copyright (c) 2024 Renilson Almeida
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#ifndef BTREE_MANAGER_H_
#define BTREE_MANAGER_H_

#include "btree_process.h"

/**
 * @brief Function that manages and performs a step in the tree.
 *
 * @param data_tree[in] Pointer to tree struct.
 * @retval BTREE_DEFINITION_STATUS_RUNNING if running tree.
 * @retval BTREE_DEFINITION_STATUS_SUCCESS if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_FAIL if failed tree.
 * @retval BTREE_DEFINITION_STATUS_STAND_BY if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_ERROR if irregular tree.
 */
btree_definition_status_t btree_manager_tick_tree(
    btree_definition_tree_data_t *struct_tree);

/**
 * @brief Function to execute tree with reactivity.
 *
 * @param data_tree[in] Pointer to tree struct.
 * @retval BTREE_DEFINITION_STATUS_RUNNING if running tree.
 * @retval BTREE_DEFINITION_STATUS_SUCCESS if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_FAIL if failed tree.
 * @retval BTREE_DEFINITION_STATUS_STAND_BY if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_ERROR if irregular tree.
 */
btree_definition_status_t btree_manager_reactivity_tick_tree(
    btree_definition_tree_data_t *struct_tree);

/**
 * @brief Function to reset behavior tree.
 *
 * @param data_tree[in] Pointer to tree struct.
 * @retval BTREE_DEFINITION_STATUS_SUCCESS if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_ERROR if irregular tree.
 */
btree_definition_status_t btree_manager_reset_tree(
    btree_definition_tree_data_t *struct_tree);

/**
 * @brief Help function to tick tree.
 *
 * @param struct_tree[in] Pointer to tree struct.
 * @param functions_case[in] Pointer to functions case struct.
 * @retval BTREE_DEFINITION_STATUS_RUNNING if running tree.
 * @retval BTREE_DEFINITION_STATUS_SUCCESS if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_FAIL if failed tree.
 * @retval BTREE_DEFINITION_STATUS_STAND_BY if successfully executed tree.
 * @retval BTREE_DEFINITION_STATUS_ERROR if irregular tree.
 */
btree_definition_status_t btree_manager_tick(
    btree_definition_tree_data_t *struct_tree,
    btree_definition_config_functions_t *functions_case);

#endif /* BTREE_MANAGER_H_ */
