/**
 * @file btree_common.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Behavior tree common.
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

#include "btree_common.h"

#if BTREE_COMMON_DEBUG
#include <stdio.h>
#endif

#if BTREE_COMMON_DEBUG

/**
 * @brief Array of status to debug.
 * 
 */
static const char *btree_common_array_status_debug[__BTREE_DEFINITION_STATUS_AMOUNT] = {
  [BTREE_DEFINITION_STATUS_RUNNING] = "Running",
  [BTREE_DEFINITION_STATUS_SUCCESS] = "Success",
  [BTREE_DEFINITION_STATUS_FAIL] = "Fail",
  [BTREE_DEFINITION_STATUS_RE_EXECUTE] = "Re-execute",
  [BTREE_DEFINITION_STATUS_STAND_BY] = "Stand by",
  [BTREE_DEFINITION_STATUS_ERROR] = "Error",
};

/**
 * @brief Strings of nodes types.
 * 
 * @param node_type Type of node.
 * @return const char* Name of node, Unknown otherwise.
 */
static const char *btree_common_node_type_string(btree_definition_node_type_t node_type)
{
  switch (node_type) {
    case BTREE_DEFINITION_NODE_CONDITION: return "Condition";
    case BTREE_DEFINITION_NODE_ACTION: return "Action";
    case BTREE_DEFINITION_NODE_ACTION_SLEEP: return "Action Sleep";
    case BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS: return "Retry Until Success"; 
    case BTREE_DEFINITION_NODE_REPEAT: return "Repeat";
    case BTREE_DEFINITION_NODE_KEEP_RUNNING_UNTIL_SUCCESS: return "Keep Running Until Success"; 
    case BTREE_DEFINITION_NODE_INVERTER: return "Inverter";
    case BTREE_DEFINITION_NODE_FORCE_SUCCESS: return "Force Success";
    case BTREE_DEFINITION_NODE_FORCE_FAIL: return "Force Fail";
    case BTREE_DEFINITION_NODE_REACTIVE_CONDITION: return "Reactive Condition";
    case BTREE_DEFINITION_NODE_REACTIVE_ACTION: return "Reactive Action";
    case BTREE_DEFINITION_NODE_REACTIVE_ACTION_SLEEP: return "Reactive Action Sleep"; 
    case BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS: return "Reactive Retry Until Success"; 
    case BTREE_DEFINITION_NODE_REACTIVE_REPEAT: return "Reactive Repeat";
    case BTREE_DEFINITION_NODE_REACTIVE_KEEP_RUNNING_UNTIL_SUCCESS: return "Reactive Keep Running Until Success"; 
    case BTREE_DEFINITION_NODE_REACTIVE_INVERTER: return "Reactive Inverter";
    case BTREE_DEFINITION_NODE_REACTIVE_FORCE_SUCCESS: return "Reactive Force Success";
    case BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL: return "Reactive Force Fail";
    default: return "Unknown";
  }
}

void btree_common_debug_print(btree_index_t index,
                              btree_definition_status_t status, 
                              btree_definition_node_type_t node_type, 
                              const char *tree_name, const char *const *functions_name) {
  char line[BTREE_COMMON_DEBUG_LINE_SIZE];
  const char *status_string = "Unknown";
  const char *function_name = NULL;
  int length = 0;

  if ((unsigned)status < (unsigned)__BTREE_DEFINITION_STATUS_AMOUNT) {
    status_string = btree_common_array_status_debug[status];
  }

  if ((functions_name) && (functions_name[index]) && (functions_name[index][0] != '\0')) {
    function_name = functions_name[index];
  }

  length = snprintf(line, sizeof(line),
                    "[BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s%s%s\n",
                    tree_name ? tree_name : "Unknown", (int)index, status_string,
                    btree_common_node_type_string(node_type),
                    function_name ? " | Function: " : "",
                    function_name ? function_name : "");
  if (length < 0) {
    return;
  }
  if ((size_t)length >= sizeof(line)) {
    line[sizeof(line) - 2] = '\n';
  }

  btree_common_debug_output(line);
}
#endif
