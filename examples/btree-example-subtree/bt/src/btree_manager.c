/**
 * @file btree_manager.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Behavior tree manager.
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
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#include "btree_manager.h"
#include "string.h"

btree_definition_status_t btree_manager_tick_tree(btree_definition_tree_data_t *struct_tree)
{
    if (struct_tree == NULL)
    {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    btree_definition_status_t tree_status = BTREE_DEFINITION_STATUS_SUCCESS;
    btree_index_t index_status_key = 0;
    uint32_t index_status_position = 0;

    index_status_key = (struct_tree->node_index & 0x0F) << 1;
    index_status_position = struct_tree->node_index >> 4;
    tree_status = btree_process_node(struct_tree, index_status_key, index_status_position);

    if((struct_tree->node_index != BTREE_DEFINITION_TREE_UNRELATED) && (tree_status != BTREE_DEFINITION_STATUS_STAND_BY))
    {
        tree_status = BTREE_DEFINITION_STATUS_RUNNING;
    }

    return tree_status;
}

btree_definition_status_t btree_manager_reactivity_tick_tree(btree_definition_tree_data_t *struct_tree)
{
    uint8_t check_node = 0;
    btree_definition_status_t tree_status = BTREE_DEFINITION_STATUS_SUCCESS;
    btree_definition_node_type_t node_type = BTREE_DEFINITION_NODE_CONDITION;
    btree_index_t node_index = struct_tree->node_index;
    btree_index_t index = struct_tree->node_index;
    btree_index_t index_status_key = 0;
    uint32_t index_status_position = 0;
    uint32_t mask = 0;
    uint32_t value_updated = 0;
    uint32_t value_status = struct_tree->nodes_status[BTREE_DEFINITION_NODE_FIRST_INDEX];

    if (struct_tree == NULL)
    {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    struct_tree->node_index = 0;

    while (struct_tree->node_index < node_index)
    {
        node_type = struct_tree->tree[struct_tree->node_index].node_type;
        index = struct_tree->node_index;
        index_status_key = (struct_tree->node_index & 0x0F) << 1;
        index_status_position = struct_tree->node_index >> 4;
        value_status = struct_tree->nodes_status[index_status_position];
        check_node = (value_status >> index_status_key) & 0b11;

        if ((node_type & BTREE_DEFINITION_NODE_REACTIVE_NODES) && (check_node != BTREE_DEFINITION_STATUS_RUNNING))
        {
            if (((node_type >= BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS) && (node_type <= BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL)) ||
                ((node_type >= BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS) && (node_type <= BTREE_DEFINITION_NODE_FORCE_FAIL)))
            {
                struct_tree->last_node_state = check_node;
            }

            tree_status = btree_process_node(struct_tree, index_status_key, index_status_position);
            if (tree_status == BTREE_DEFINITION_STATUS_STAND_BY)
            {
                return BTREE_DEFINITION_STATUS_STAND_BY;
            }
            continue;
        }

        index_status_key = (struct_tree->node_index & 0x0F) << 1;
        index_status_position = struct_tree->node_index >> 4;
        value_status = struct_tree->nodes_status[index_status_position];
        check_node = (value_status >> index_status_key) & 0b11;

        if ((struct_tree->node_index < node_index) && (check_node != BTREE_DEFINITION_STATUS_RE_EXECUTE))
        {
            if (check_node == BTREE_DEFINITION_STATUS_SUCCESS)
            {
                struct_tree->node_index = struct_tree->tree[struct_tree->node_index].st_index;
            }
            else if ((check_node == BTREE_DEFINITION_STATUS_RUNNING) || (check_node == BTREE_DEFINITION_STATUS_RE_EXECUTE))
            {
                struct_tree->node_index = struct_tree->node_index + 1;//struct_tree->tree[struct_tree->node_index].decorator_node.target_index;
            }
            else if (check_node == BTREE_DEFINITION_STATUS_FAIL)
            {
                struct_tree->node_index = struct_tree->tree[struct_tree->node_index].ft_index;
            }

            if (index > struct_tree->node_index)
            {
                struct_tree->last_node_state = check_node;
                index_status_key = (struct_tree->node_index & 0x0F) << 1;
                index_status_position = struct_tree->node_index >> 4;
                value_status = struct_tree->nodes_status[index_status_position];
                mask = (0b11 << (index_status_key));
                value_updated = (value_status & (~mask));
                if (check_node == BTREE_DEFINITION_STATUS_SUCCESS)
                {
                    struct_tree->nodes_status[index_status_position] = (value_updated) | (0b01 << (index_status_key));
                }
                else if (check_node == BTREE_DEFINITION_STATUS_FAIL)
                {
                    struct_tree->nodes_status[index_status_position] = (value_updated) | (0b10 << (index_status_key));
                }
            }
        }
    }

    node_type = struct_tree->tree[struct_tree->node_index].node_type;
    index_status_key = (struct_tree->node_index & 0x0F) << 1;
    index_status_position = struct_tree->node_index >> 4;
    value_status = struct_tree->nodes_status[index_status_position];
    check_node = (value_status >> index_status_key) & 0b11;

    if (((node_type >= BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS) && (node_type <= BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL)) ||
        ((node_type >= BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS) && (node_type <= BTREE_DEFINITION_NODE_FORCE_FAIL)))
    {
        struct_tree->last_node_state = check_node;
    }

    tree_status = btree_process_node(struct_tree, index_status_key, index_status_position);
    if(struct_tree->node_index != BTREE_DEFINITION_TREE_UNRELATED)
    {
        tree_status = BTREE_DEFINITION_STATUS_RUNNING;
    }

    return tree_status;
}

btree_definition_status_t btree_manager_reset_tree(btree_definition_tree_data_t *struct_tree)
{
    if (struct_tree == NULL)
    {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    struct_tree->last_node_state = BTREE_DEFINITION_STATUS_RUNNING;
    struct_tree->node_index = BTREE_DEFINITION_NODE_FIRST_INDEX;

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_manager_clear_nodes(btree_definition_tree_data_t *struct_tree)
{
    if (struct_tree == NULL)
    {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    memset(struct_tree->nodes_status, 0, ((struct_tree->tree_size >> 4) + 1) * sizeof(struct_tree->nodes_status[0]));


    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_manager_tick(btree_definition_tree_data_t *struct_tree, btree_definition_config_functions_t *functions_case)
{
    if ((struct_tree == NULL) || (functions_case == NULL) ||
        (functions_case->function_tick == NULL) || (functions_case->success_case == NULL) ||
        (functions_case->fail_case == NULL) || (functions_case->running_case == NULL))
    {
        return BTREE_DEFINITION_STATUS_ERROR;
    }

    btree_definition_status_t tree_status = BTREE_DEFINITION_STATUS_RUNNING;
    tree_status = functions_case->function_tick(struct_tree);

    switch (tree_status)
    {
    case BTREE_DEFINITION_STATUS_RUNNING:{
        tree_status = functions_case->running_case(struct_tree);
        break;
    }
    case BTREE_DEFINITION_STATUS_SUCCESS: {
        tree_status = functions_case->success_case(struct_tree);
        break;
    }
    case BTREE_DEFINITION_STATUS_FAIL: {
        tree_status = functions_case->fail_case(struct_tree);
        break;
    }
    case BTREE_DEFINITION_STATUS_STAND_BY: {
        tree_status = functions_case->standby_case(struct_tree);
        break;
    }
    default:
        tree_status = BTREE_DEFINITION_STATUS_ERROR;
        break;
    }

    return tree_status;
}
