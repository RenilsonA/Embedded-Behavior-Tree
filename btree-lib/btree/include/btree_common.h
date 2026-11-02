/**
 * @file btree_process.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of behavior tree common.
 * @version 1.0
 * @date 30/06/24
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

#ifndef BTREE_COMMON_H_
#define BTREE_COMMON_H_

#include "btree_definition.h"
#include "stdbool.h"

/**
 * @brief Maximum size of one debug line, including the '\n' and the '\0'.
 * Longer lines are truncated.
 *
 */
#ifndef BTREE_COMMON_DEBUG_LINE_SIZE
#define BTREE_COMMON_DEBUG_LINE_SIZE 160
#endif

/**
 * @brief Macro used call debug. Define BTREE_COMMON_DEBUG with a non-zero value in the project to enable debug.
 * 
 */
#if BTREE_COMMON_DEBUG
#define BTREE_DEBUG_PRINT(_index, _status, _type, _debug) \
    do { \
        if (_debug) { \
            btree_common_debug_print(_index, _status, _type, _debug->tree_name, _debug->functions_name); \
        } \
    } while(0)
#else
#define BTREE_DEBUG_PRINT(_index, _status, _type, _debug) ((void)0)
#endif

/**
 * @brief Function for delay within the behavior tree. Its implementation is platform-dependent and should be provided by the user.
 *
 * @param timeout_ms Wait timeout value in milliseconds.
 * @retval 0 if successful (the Sleep node returns SUCCESS).
 * @retval != 0 if fail something (the Sleep node returns FAIL).
 */
int btree_common_delay_ms(uint32_t timeout_ms);

#if BTREE_COMMON_DEBUG

/**
 * @brief Function for debug. Its implementation is platform-dependent and should be provided by the user. Called by btree_common_debug_print.
 *
 * @param line[in] Null-terminated line, already ending with '\n'.
 */
void btree_common_debug_output(const char *line);

/**
 * @brief Builds one debug line in the format:
 * [BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s | Function: %s\n
 *
 * @param index Index of node.
 * @param status Status of node.
 * @param node_type Type of node.
 * @param tree_name[in] Name of tree.
 * @param functions_name[in] Array of functions names.
 */
void btree_common_debug_print(btree_index_t index,
                              btree_definition_status_t status, 
                              uint8_t node_type, 
                              const char *tree_name, const char *const *functions_name);
#endif

#endif /* BTREE_COMMON_H_ */
