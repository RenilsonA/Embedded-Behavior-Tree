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

/**
 * @brief Minimum quantity of attempts.
 *
 */
#define BTREE_PROCESS_MIN_ATTEMPTS 0

btree_definition_status_t btree_process_node(btree_definition_tree_data_t *struct_tree)
{
    if ((struct_tree == NULL) || (struct_tree->node_index >= struct_tree->tree_size)) {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    btree_index_t index                        = struct_tree->node_index;
    const btree_definition_node_t *node_struct = &(struct_tree->tree[index]);
    uint8_t node_type                          = node_struct->node_type;
    btree_definition_status_t status           = BTREE_DEFINITION_STATUS_ERROR;
    btree_definition_attempts_t *attempts      = NULL;
    btree_definition_status_t child_status = struct_tree->last_node_state;
    uint8_t enter_child = (child_status == BTREE_DEFINITION_STATUS_RUNNING);

    switch (node_type) {
    case BTREE_DEFINITION_NODE_CONDITION:
    case BTREE_DEFINITION_NODE_ACTION:
    case BTREE_DEFINITION_NODE_REACTIVE_CONDITION:
    case BTREE_DEFINITION_NODE_REACTIVE_ACTION: {
        enter_child = 0;
        status      = node_struct->interaction_node.function();
        break;
    }

    case BTREE_DEFINITION_NODE_ACTION_SLEEP:
    case BTREE_DEFINITION_NODE_REACTIVE_ACTION_SLEEP: {
        enter_child = 0;
        status      = btree_common_delay_ms(node_struct->interaction_node.timeout_ms);
        status      = (status == 0) ? BTREE_DEFINITION_STATUS_SUCCESS : BTREE_DEFINITION_STATUS_FAIL;
        break;
    }

    case BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS:
    case BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS: {
        attempts = &(struct_tree->array_attempts[node_struct->decorator_node.index]);
        if (enter_child) {
            *attempts    = node_struct->decorator_node.times;
            child_status = BTREE_DEFINITION_STATUS_FAIL;
        }
        enter_child = (child_status == BTREE_DEFINITION_STATUS_FAIL)
                      && (*attempts > BTREE_PROCESS_MIN_ATTEMPTS);
        if (enter_child) {
            *attempts -= 1;
        }
        status = child_status;
        break;
    }

    case BTREE_DEFINITION_NODE_REPEAT:
    case BTREE_DEFINITION_NODE_REACTIVE_REPEAT: {
        attempts = &(struct_tree->array_attempts[node_struct->decorator_node.index]);
        if (enter_child) {
            *attempts    = node_struct->decorator_node.times;
            child_status = BTREE_DEFINITION_STATUS_SUCCESS;
        }
        enter_child = (child_status == BTREE_DEFINITION_STATUS_SUCCESS)
                      && (*attempts > BTREE_PROCESS_MIN_ATTEMPTS);
        if (enter_child) {
            *attempts -= 1;
        }
        status = child_status;
        break;
    }

    case BTREE_DEFINITION_NODE_KEEP_RUNNING_UNTIL_FAILURE:
    case BTREE_DEFINITION_NODE_REACTIVE_KEEP_RUNNING_UNTIL_FAILURE: {
        enter_child |= (child_status == BTREE_DEFINITION_STATUS_SUCCESS);
        status = child_status;
        break;
    }

    case BTREE_DEFINITION_NODE_INVERTER:
    case BTREE_DEFINITION_NODE_REACTIVE_INVERTER: {
        status = (child_status == BTREE_DEFINITION_STATUS_SUCCESS)
                     ? BTREE_DEFINITION_STATUS_FAIL
                     : BTREE_DEFINITION_STATUS_SUCCESS;
        break;
    }

    case BTREE_DEFINITION_NODE_FORCE_SUCCESS:
    case BTREE_DEFINITION_NODE_REACTIVE_FORCE_SUCCESS: {
        status = BTREE_DEFINITION_STATUS_SUCCESS;
        break;
    }

    case BTREE_DEFINITION_NODE_FORCE_FAIL:
    case BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL: {
        status = BTREE_DEFINITION_STATUS_FAIL;
        break;
    }

    default: {
        return BTREE_DEFINITION_STATUS_ERROR;
    }
    }

    if (enter_child) {
        struct_tree->node_index      = index + 1;
        struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;
        BTREE_DEBUG_PRINT(index, BTREE_DEFINITION_STATUS_RUNNING, node_type, struct_tree->debug);
        return BTREE_DEFINITION_STATUS_RUNNING;
    }

    BTREE_DEBUG_PRINT(index, status, node_type, struct_tree->debug);
    if (status == BTREE_DEFINITION_STATUS_SUCCESS) {
        struct_tree->node_index = node_struct->st_index;
    } else if (status == BTREE_DEFINITION_STATUS_FAIL) {
        struct_tree->node_index = node_struct->ft_index;
    } else if ((status == BTREE_DEFINITION_STATUS_RUNNING)
               || (status == BTREE_DEFINITION_STATUS_STAND_BY)) {
        struct_tree->last_node_state = BTREE_DEFINITION_STATUS_STAND_BY;
        return BTREE_DEFINITION_STATUS_STAND_BY;
    } else {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    struct_tree->last_node_state =
        (struct_tree->node_index < index) ? status : BTREE_DEFINITION_STATUS_RUNNING;

    return status;
}
