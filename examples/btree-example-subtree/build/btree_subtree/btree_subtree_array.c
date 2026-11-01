/**
 * @file btree_subtree_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 12/05/2025
 *
 */

#include "btree_subtree_array.h"
#include "btree_subtree_subtree.h"

/**
 * @brief Array containing the nodes of the subtree tree.
 *
 */
const btree_definition_node_t btree_subtree_array[BTREE_SUBTREE_ARRAY_SIZE] = 
{
         [0] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_SUCCESS(2, BTREE_DEFINITION_TREE_UNRELATED), \
         [1] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(0, 0, &btree_subtree_subtree_condition1), \
         [2] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_INVERTER(4, BTREE_DEFINITION_TREE_UNRELATED), \
         [3] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(2, 2, &btree_subtree_subtree_action1), \
         [4] = BTREE_DEFINITION_CREATE_NODE_FORCE_FAIL(7, 6), \
         [5] = BTREE_DEFINITION_CREATE_NODE_CONDITION(4, 4, &btree_subtree_subtree_condition2), \
         [6] = BTREE_DEFINITION_CREATE_NODE_ACTION(7, BTREE_DEFINITION_TREE_UNRELATED, &btree_subtree_subtree_action2), \
         [7] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_RETRY_UNTIL_SUCCESS(11, BTREE_DEFINITION_TREE_UNRELATED, 5, 0, 10), \
         [8] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(7, 9, &btree_subtree_subtree_condition3), \
         [9] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_REPEAT(7, 7, 5, 1, 10), \
         [10] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(9, 9, &btree_subtree_subtree_action3), \
         [11] = BTREE_DEFINITION_CREATE_NODE_KEEP_RUNNING_UNTIL_FAILURE(13, BTREE_DEFINITION_TREE_UNRELATED, 12), \
         [12] = BTREE_DEFINITION_CREATE_NODE_ACTION(11, 11, &btree_subtree_subtree_action4), \
         [13] = BTREE_DEFINITION_CREATE_NODE_RETRY_UNTIL_SUCCESS(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 9, 2, 15), \
         [14] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(15, 13, &btree_subtree_subtree_action5), \
         [15] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(13, 13, &btree_subtree_subtree_action6), \
};

/**
 * @brief subtree tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_subtree_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_SUBTREE_ARRAY_SIZE,
    .nodes_status    = btree_subtree_status_nodes,
    .array_attempts  = btree_subtree_common_attempts,
    .tree            = btree_subtree_array,
};

