/**
 * @file btree_example_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 02/11/2026
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
        [0] = BTREE_DEFINITION_CREATE_NODE_CONDITION(7, 1, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_condition1), 
        [1] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(2, BTREE_DEFINITION_TREE_UNRELATED, 0, &btree_example_example_action1), 
        [2] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(5, 3, 1, &btree_example_example_condition2), 
        [3] = BTREE_DEFINITION_CREATE_NODE_ACTION(5, 4, 2, &btree_example_example_action2), 
        [4] = BTREE_DEFINITION_CREATE_NODE_ACTION(5, BTREE_DEFINITION_TREE_UNRELATED, 2, &btree_example_example_action3), 
        [5] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(7, 6, 1, &btree_example_example_condition4), 
        [6] = BTREE_DEFINITION_CREATE_NODE_ACTION(7, BTREE_DEFINITION_TREE_UNRELATED, 5, &btree_example_example_action4), 
        [7] = BTREE_DEFINITION_CREATE_NODE_CONDITION(BTREE_DEFINITION_TREE_UNRELATED, 8, BTREE_DEFINITION_TREE_UNRELATED, &btree_example_example_condition5), 
        [8] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(9, BTREE_DEFINITION_TREE_UNRELATED, 7, &btree_example_example_action5), 
        [9] = BTREE_DEFINITION_CREATE_NODE_CONDITION(12, 10, 8, &btree_example_example_condition6), 
        [10] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(12, 11, 9, &btree_example_example_action6), 
        [11] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(12, BTREE_DEFINITION_TREE_UNRELATED, 9, &btree_example_example_action7), 
        [12] = BTREE_DEFINITION_CREATE_NODE_ACTION(13, BTREE_DEFINITION_TREE_UNRELATED, 8, &btree_example_example_actio8), 
        [13] = BTREE_DEFINITION_CREATE_NODE_CONDITION(15, 14, 8, &btree_example_example_condition7), 
        [14] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(15, BTREE_DEFINITION_TREE_UNRELATED, 13, &btree_example_example_action9), 
        [15] = BTREE_DEFINITION_CREATE_NODE_ACTION(16, BTREE_DEFINITION_TREE_UNRELATED, 8, &btree_example_example_action10), 
        [16] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 15, &btree_example_example_action11), 
};

#if BTREE_COMMON_DEBUG
/**
 * @brief Array containing the debug string names of the nodes of example tree.
 *
 */
static const char * const btree_example_array_debug[BTREE_EXAMPLE_ARRAY_SIZE] = 
{
        "btree_example_example_condition1",
        "btree_example_example_action1",
        "btree_example_example_condition2",
        "btree_example_example_action2",
        "btree_example_example_action3",
        "btree_example_example_condition4",
        "btree_example_example_action4",
        "btree_example_example_condition5",
        "btree_example_example_action5",
        "btree_example_example_condition6",
        "btree_example_example_action6",
        "btree_example_example_action7",
        "btree_example_example_actio8",
        "btree_example_example_condition7",
        "btree_example_example_action9",
        "btree_example_example_action10",
        "btree_example_example_action11",
};

/**
 * @brief Struct of debug information of the example tree.
 *
 */
static const btree_definition_debug_t btree_example_debug_item = {
    .tree_name = "EXAMPLE",
    .functions_name = btree_example_array_debug,
};
#endif

/**
 * @brief example tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_example_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_EXAMPLE_ARRAY_SIZE,
    .tick_index      = BTREE_DEFINITION_TREE_UNRELATED,
    .array_attempts  = NULL,
    .tree            = btree_example_array,
#if BTREE_COMMON_DEBUG
    .debug           = &btree_example_debug_item,
#else
    .debug           = NULL,
#endif
};

