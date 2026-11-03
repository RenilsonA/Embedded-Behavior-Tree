/**
 * @file btree_subtree_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 02/11/2026
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
        [0] = BTREE_DEFINITION_CREATE_NODE_FORCE_SUCCESS(2, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED), 
        [1] = BTREE_DEFINITION_CREATE_NODE_CONDITION(0, 0, BTREE_DEFINITION_TREE_UNRELATED, &btree_subtree_subtree_condition1), 
        [2] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_INVERTER(4, BTREE_DEFINITION_TREE_UNRELATED, 0), 
        [3] = BTREE_DEFINITION_CREATE_NODE_ACTION(2, 2, 2, &btree_subtree_subtree_action1), 
        [4] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_FAIL(7, 6, 0), 
        [5] = BTREE_DEFINITION_CREATE_NODE_CONDITION(4, 4, 4, &btree_subtree_subtree_condition2), 
        [6] = BTREE_DEFINITION_CREATE_NODE_ACTION(7, BTREE_DEFINITION_TREE_UNRELATED, 4, &btree_subtree_subtree_action2), 
        [7] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_RETRY_UNTIL_SUCCESS(11, BTREE_DEFINITION_TREE_UNRELATED, 0, 5, 0, 10), 
        [8] = BTREE_DEFINITION_CREATE_NODE_CONDITION(7, 9, 7, &btree_subtree_subtree_condition3), 
        [9] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_REPEAT(7, 7, 8, 5, 1, 10), 
        [10] = BTREE_DEFINITION_CREATE_NODE_ACTION(9, 9, 9, &btree_subtree_subtree_action3), 
        [11] = BTREE_DEFINITION_CREATE_NODE_KEEP_RUNNING_UNTIL_FAILURE(13, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 12), 
        [12] = BTREE_DEFINITION_CREATE_NODE_ACTION(11, 11, BTREE_DEFINITION_TREE_UNRELATED, &btree_subtree_subtree_action4), 
        [13] = BTREE_DEFINITION_CREATE_NODE_RETRY_UNTIL_SUCCESS(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 9, 0, 15), 
        [14] = BTREE_DEFINITION_CREATE_NODE_ACTION(15, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_subtree_subtree_action5), 
        [15] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(13, 13, 14, &btree_subtree_subtree_action6), 
};

#if BTREE_COMMON_DEBUG
/**
 * @brief Array containing the debug string names of the nodes of subtree tree.
 *
 */
static const char * const btree_subtree_array_debug[BTREE_SUBTREE_ARRAY_SIZE] = 
{
        NULL,
        "btree_subtree_subtree_condition1",
        NULL,
        "btree_subtree_subtree_action1",
        NULL,
        "btree_subtree_subtree_condition2",
        "btree_subtree_subtree_action2",
        NULL,
        "btree_subtree_subtree_condition3",
        NULL,
        "btree_subtree_subtree_action3",
        NULL,
        "btree_subtree_subtree_action4",
        NULL,
        "btree_subtree_subtree_action5",
        "btree_subtree_subtree_action6",
};

/**
 * @brief Struct of debug information of the subtree tree.
 *
 */
static const btree_definition_debug_t btree_subtree_debug_item = {
    .tree_name = "SUBTREE",
    .functions_name = btree_subtree_array_debug,
};
#endif

/**
 * @brief subtree tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_subtree_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_SUBTREE_ARRAY_SIZE,
    .tick_index      = BTREE_DEFINITION_TREE_UNRELATED,
    .array_attempts  = btree_subtree_common_attempts,
    .tree            = btree_subtree_array,
#if BTREE_COMMON_DEBUG
    .debug           = &btree_subtree_debug_item,
#else
    .debug           = NULL,
#endif
};

