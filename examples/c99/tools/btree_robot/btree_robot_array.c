/**
 * @file btree_robot_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#include "btree_robot_array.h"
#include "btree_robot_delivery.h"

/**
 * @brief Array containing the nodes of the robot tree.
 *
 */
const btree_definition_node_t btree_robot_array[BTREE_ROBOT_ARRAY_SIZE] = 
{
        [0] = BTREE_DEFINITION_CREATE_NODE_CONDITION(2, 1, BTREE_DEFINITION_TREE_UNRELATED, &btree_robot_delivery_battery_ok), 
        [1] = BTREE_DEFINITION_CREATE_NODE_ACTION(2, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_robot_delivery_charge), 
        [2] = BTREE_DEFINITION_CREATE_NODE_RETRY_UNTIL_SUCCESS(4, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 3, 0, 3), 
        [3] = BTREE_DEFINITION_CREATE_NODE_ACTION(2, 2, BTREE_DEFINITION_TREE_UNRELATED, &btree_robot_delivery_open_door), 
        [4] = BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP(5, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 200), 
        [5] = BTREE_DEFINITION_CREATE_NODE_INVERTER(7, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED), 
        [6] = BTREE_DEFINITION_CREATE_NODE_CONDITION(5, 5, BTREE_DEFINITION_TREE_UNRELATED, &btree_robot_delivery_obstacle_detected), 
        [7] = BTREE_DEFINITION_CREATE_NODE_ACTION(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_robot_delivery_deliver_package), 
};

#if BTREE_COMMON_DEBUG
/**
 * @brief Array containing the debug string names of the nodes of robot tree.
 *
 */
static const char * const btree_robot_array_debug[BTREE_ROBOT_ARRAY_SIZE] = 
{
        "btree_robot_delivery_battery_ok",
        "btree_robot_delivery_charge",
        NULL,
        "btree_robot_delivery_open_door",
        NULL,
        NULL,
        "btree_robot_delivery_obstacle_detected",
        "btree_robot_delivery_deliver_package",
};

/**
 * @brief Struct of debug information of the robot tree.
 *
 */
static const btree_definition_debug_t btree_robot_debug_item = {
    .tree_name = "ROBOT",
    .functions_name = btree_robot_array_debug,
};
#endif

/**
 * @brief robot tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_robot_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_ROBOT_ARRAY_SIZE,
    .tick_index      = BTREE_DEFINITION_TREE_UNRELATED,
    .array_attempts  = btree_robot_common_attempts,
    .tree            = btree_robot_array,
#if BTREE_COMMON_DEBUG
    .debug           = &btree_robot_debug_item,
#else
    .debug           = NULL,
#endif
};

