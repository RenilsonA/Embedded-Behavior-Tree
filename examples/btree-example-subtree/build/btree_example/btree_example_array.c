/**
 * @file btree_example_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 12/05/2025
 *
 */

#include "btree_example_array.h"
#include "btree_example_example.h"

/**
 * @brief Array containing the nodes of the example tree.
 *
 */
const btree_definition_node_t btree_example_array[BTREE_EXAMPLE_ARRAY_SIZE] = 
{
         [0] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(7, 1, &btree_example_example_condition1), \
         [1] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(2, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action1), \
         [2] = BTREE_DEFINITION_CREATE_NODE_CONDITION(5, 3, &btree_example_example_condition2), \
         [3] = BTREE_DEFINITION_CREATE_NODE_ACTION(5, 4, &btree_example_example_action2), \
         [4] = BTREE_DEFINITION_CREATE_NODE_ACTION(5, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action3), \
         [5] = BTREE_DEFINITION_CREATE_NODE_CONDITION(7, 6, &btree_example_example_condition4), \
         [6] = BTREE_DEFINITION_CREATE_NODE_ACTION(7, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action4), \
         [7] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(BTREE_DEFINITION_TREE_UNRELATED, 8, &btree_example_example_condition5), \
         [8] = BTREE_DEFINITION_CREATE_NODE_ACTION(9, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action5), \
         [9] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(12, 10, &btree_example_example_condition6), \
         [10] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(12, 11, &btree_example_example_action6), \
         [11] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(12, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action7), \
         [12] = BTREE_DEFINITION_CREATE_NODE_ACTION(13, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_actio8), \
         [13] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(15, 14, &btree_example_example_condition7), \
         [14] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(15, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action9), \
         [15] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(16, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action10), \
         [16] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_action11), \
};

/**
 * @brief example tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_example_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_EXAMPLE_ARRAY_SIZE,
    .nodes_status    = btree_example_status_nodes,
    .array_attempts  = btree_example_common_attempts,
    .tree            = btree_example_array,
};

