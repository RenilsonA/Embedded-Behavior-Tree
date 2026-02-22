/**
 * @file btree_process.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Behavior tree process.
 * @version 1.1
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

#include "btree_process.h"
#include <stdio.h>

/**
 * @brief Minimum quantity of attempts.
 *
 */
#define BTREE_PROCESS_MIN_ATTEMPTS 0

/**
 * @brief Check if node is running.
 *
 */
#define BTREE_PROCESS_CHECK_RUNNING(_tree_ptr)                                 \
  do {                                                                         \
    if ((_tree_ptr)->last_node_state != BTREE_DEFINITION_STATUS_RUNNING) {     \
      (_tree_ptr)->node_index = 0;                                             \
      return BTREE_DEFINITION_STATUS_ERROR;                                    \
    }                                                                          \
  } while (0)

btree_definition_status_t
btree_process_node(btree_definition_tree_data_t *struct_tree,
                   btree_index_t index_status_key,
                   uint32_t index_status_position) {

  if (struct_tree == NULL) {
    return BTREE_DEFINITION_STATUS_ERROR;
  }
  
  if (struct_tree->node_index == BTREE_DEFINITION_TREE_UNRELATED) {
    return BTREE_DEFINITION_STATUS_ERROR;
  }

  btree_definition_status_t status = BTREE_DEFINITION_STATUS_RUNNING;
  const btree_definition_node_t *node_struct = &(struct_tree->tree[index]);
  btree_definition_node_type_t node_type = node_struct->node_type;
  uint32_t value_status = 0;
  uint32_t mask = 0;
  btree_index_t key = 0;
  btree_index_t position = 0;
  uint32_t nodes_status = 0;
  uint32_t new_value = 0;
  btree_index_t clear_index = 0;

  if (struct_tree == NULL) {
    return BTREE_DEFINITION_STATUS_ERROR;
  }

  if (index == BTREE_DEFINITION_TREE_UNRELATED) {
    return BTREE_DEFINITION_STATUS_FAIL;
  }

  BTREE_DEBUG_PRINT(index, status, node_type, struct_tree->debug);

  switch (node_type) {
  case BTREE_DEFINITION_NODE_ACTION:
  case BTREE_DEFINITION_NODE_CONDITION:
  case BTREE_DEFINITION_NODE_REACTIVE_ACTION:
  case BTREE_DEFINITION_NODE_REACTIVE_CONDITION: {
    status = node_struct->interaction_node.function();
    if ((status == BTREE_DEFINITION_STATUS_RUNNING) ||
        (status == BTREE_DEFINITION_STATUS_STAND_BY)) {
      return BTREE_DEFINITION_STATUS_STAND_BY;
    }
    break;
  }

  case BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS:
  case BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS: {
    if ((struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RUNNING) ||
        (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RE_EXECUTE)) {
      if (node_struct->decorator_node.times <= 0) {
        status = BTREE_DEFINITION_STATUS_ERROR;
        break;
      }
      struct_tree->array_attempts[node_struct->decorator_node.index] =
          node_struct->decorator_node.times - 1;
      struct_tree->node_index = struct_tree->node_index + 1;

      struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;
      mask = (0b11 << (index_status_key));
      value_status = struct_tree->nodes_status[index_status_position] & (~mask);
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b00 << (index_status_key));

      return BTREE_DEFINITION_STATUS_RUNNING;
    } else if ((struct_tree->last_node_state == BTREE_DEFINITION_STATUS_FAIL) &&
               (struct_tree->array_attempts[node_struct->decorator_node.index] >
                BTREE_PROCESS_MIN_ATTEMPTS)) {
      struct_tree->array_attempts[node_struct->decorator_node.index] -= 1;
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;

      clear_index = struct_tree->node_index;

      do {
        key = (clear_index & 0x0F) << 1;
        position = clear_index >> 4;
        nodes_status = struct_tree->nodes_status[position];
        mask = (0b11 << (key));
        new_value = (nodes_status & (~mask));
        struct_tree->nodes_status[position] = (new_value) | (0b11 << (key));
        clear_index += 1;
      } while (clear_index <= node_struct->decorator_node.node_limit);
    } else {
      status = struct_tree->last_node_state;
      struct_tree->array_attempts[node_struct->decorator_node.index] =
          BTREE_PROCESS_MIN_ATTEMPTS;
    }

    break;
  }

  case BTREE_DEFINITION_NODE_REPEAT:
  case BTREE_DEFINITION_NODE_REACTIVE_REPEAT: {

    if ((struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RUNNING) ||
        (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RE_EXECUTE)) {
      if (node_struct->decorator_node.times <= 0) {
        status = BTREE_DEFINITION_STATUS_ERROR;
        break;
      }
      struct_tree->array_attempts[node_struct->decorator_node.index] =
          node_struct->decorator_node.times - 1;
      struct_tree->node_index = struct_tree->node_index + 1;

      mask = (0b11 << (index_status_key));
      value_status = struct_tree->nodes_status[index_status_position] & (~mask);
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b00 << (index_status_key));
      struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;

      return BTREE_DEFINITION_STATUS_RUNNING;
    } else if (struct_tree->array_attempts[node_struct->decorator_node.index] >
               BTREE_PROCESS_MIN_ATTEMPTS) {
      struct_tree->array_attempts[node_struct->decorator_node.index] -= 1;
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;

      clear_index = struct_tree->node_index;

      do {
        key = (clear_index & 0x0F) << 1;
        position = clear_index >> 4;
        nodes_status = struct_tree->nodes_status[position];
        mask = (0b11 << (key));
        new_value = (nodes_status & (~mask));
        struct_tree->nodes_status[position] = (new_value) | (0b11 << (key));
        clear_index += 1;
      } while (clear_index <= node_struct->decorator_node.node_limit);
    } else {
      status = struct_tree->last_node_state;
      struct_tree->array_attempts[node_struct->decorator_node.index] =
          BTREE_PROCESS_MIN_ATTEMPTS;
    }
    break;
  }

  case BTREE_DEFINITION_NODE_KEEP_RUNNING_UNTIL_SUCCESS:
  case BTREE_DEFINITION_NODE_REACTIVE_KEEP_RUNNING_UNTIL_SUCCESS: {
    if ((struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RUNNING) ||
        (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_FAIL)) {
      struct_tree->node_index = struct_tree->node_index + 1;
      mask = (0b11 << (index_status_key));
      value_status = struct_tree->nodes_status[index_status_position] & (~mask);
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b00 << (index_status_key));
      clear_index = struct_tree->node_index;

      do {
        key = (clear_index & 0x0F) << 1;
        position = clear_index >> 4;
        nodes_status = struct_tree->nodes_status[position];
        mask = (0b11 << (key));
        new_value = (nodes_status & (~mask));
        struct_tree->nodes_status[position] = (new_value) | (0b11 << (key));
        clear_index += 1;
      } while (clear_index < node_struct->decorator_node.node_limit);

      struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;
      return BTREE_DEFINITION_STATUS_RUNNING;
    } else {
      status = struct_tree->last_node_state;
    }

    break;
  }

  case BTREE_DEFINITION_NODE_INVERTER:
  case BTREE_DEFINITION_NODE_REACTIVE_INVERTER: {
    if (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_SUCCESS) {
      status = BTREE_DEFINITION_STATUS_FAIL;
    } else if (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_FAIL) {
      status = BTREE_DEFINITION_STATUS_SUCCESS;
    } else {
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;
    }
    break;
  }

  case BTREE_DEFINITION_NODE_FORCE_SUCCESS:
  case BTREE_DEFINITION_NODE_REACTIVE_FORCE_SUCCESS: {
    if (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RUNNING) {
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;
    } else if (struct_tree->last_node_state ==
               BTREE_DEFINITION_STATUS_RE_EXECUTE) {
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;
    } else {
      status = BTREE_DEFINITION_STATUS_SUCCESS;
    }
    break;
  }

  case BTREE_DEFINITION_NODE_FORCE_FAIL:
  case BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL: {
    status = BTREE_DEFINITION_STATUS_RUNNING;
    if (struct_tree->last_node_state == BTREE_DEFINITION_STATUS_RUNNING) {
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;
    } else if (struct_tree->last_node_state ==
               BTREE_DEFINITION_STATUS_RE_EXECUTE) {
      struct_tree->node_index = struct_tree->node_index + 1;
      status = BTREE_DEFINITION_STATUS_RUNNING;
    } else {
      status = BTREE_DEFINITION_STATUS_FAIL;
    }
    break;
  }

  case BTREE_DEFINITION_NODE_ACTION_SLEEP:
  case BTREE_DEFINITION_NODE_REACTIVE_ACTION_SLEEP: {
    status =
        btree_common_action_timeout(node_struct->interaction_node.timeout_ms);
    break;
  }

  default: {
    return BTREE_DEFINITION_STATUS_ERROR;
  }
  }

  mask = (0b11 << (index_status_key));
  value_status = struct_tree->nodes_status[index_status_position] & (~mask);

  if ((status == BTREE_DEFINITION_STATUS_SUCCESS)) {
    struct_tree->node_index = node_struct->st_index;
    if ((node_type >= BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS) &&
        (node_type <= BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL)) {
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b11 << (index_status_key));
    } else {
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b01 << (index_status_key));
    }
  } else if ((status == BTREE_DEFINITION_STATUS_FAIL)) {
    struct_tree->node_index = node_struct->ft_index;
    if ((node_type >= BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS) &&
        (node_type <= BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL)) {
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b11 << (index_status_key));
    } else {
      struct_tree->nodes_status[index_status_position] =
          (value_status) | (0b10 << (index_status_key));
    }
  } else {
    struct_tree->nodes_status[index_status_position] =
        (value_status) | (0b00 << (index_status_key));
  }

  struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;
  if (index > struct_tree->node_index) {
    struct_tree->last_node_state = status;
    key = (struct_tree->node_index & 0x0F) << 1;
    position = struct_tree->node_index >> 4;
    nodes_status = struct_tree->nodes_status[position];
    mask = (0b11 << (key));
    new_value = (nodes_status & (~mask));
    if (status == BTREE_DEFINITION_STATUS_SUCCESS) {
      struct_tree->nodes_status[position] = (new_value) | (0b01 << (key));
    } else if (status == BTREE_DEFINITION_STATUS_FAIL) {
      struct_tree->nodes_status[position] = (new_value) | (0b10 << (key));
    }
  }

  return status;
}
