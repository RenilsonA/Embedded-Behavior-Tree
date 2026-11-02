/**
 * @file btree_robot_delivery.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Interface of delivery tree.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#include "btree_robot_delivery.h"

#include <stdio.h>

#include "btree_robot_blackboard.h"

btree_definition_status_t btree_robot_delivery_battery_ok(void)
{
    return (btree_robot_data.battery_percent >= 30u) ? BTREE_DEFINITION_STATUS_SUCCESS
                                                     : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_charge(void)
{
    btree_robot_data.battery_percent += 20u;
    btree_robot_data.charge_ticks += 1u;
    if (btree_robot_data.battery_percent < 90u) {
        return BTREE_DEFINITION_STATUS_RUNNING;
    }
    btree_robot_data.charge_ticks = 0u;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_robot_delivery_open_door(void)
{
    btree_robot_data.door_attempts += 1u;
    return (btree_robot_data.door_attempts >= 2u) ? BTREE_DEFINITION_STATUS_SUCCESS
                                                  : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_obstacle_detected(void)
{
    return btree_robot_data.obstacle_ahead ? BTREE_DEFINITION_STATUS_SUCCESS
                                           : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_deliver_package(void)
{
    btree_robot_data.delivered += 1u;
    btree_robot_data.battery_percent -= 25u;
    btree_robot_data.door_attempts = 0u;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}
