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
#include "btree_robot_blackboard.h"
#include <stdio.h>

/* Simulated robot: the leaves read and write the blackboard (btree_robot_data). */

btree_definition_status_t btree_robot_delivery_battery_ok(void)
{
  printf("  battery_ok?        battery at %u %%\n", (unsigned)btree_robot_data.battery_percent);
  return (btree_robot_data.battery_percent >= 30u) ? BTREE_DEFINITION_STATUS_SUCCESS
                                                   : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_charge(void)
{
  /* Long operation: each call is one step. STAND_BY tells the caller "not done yet,
     tick me again later", so the program is never blocked inside the tree. */
  btree_robot_data.battery_percent += 20u;
  btree_robot_data.charge_ticks += 1u;
  printf("  charge             battery at %u %%\n", (unsigned)btree_robot_data.battery_percent);
  if (btree_robot_data.battery_percent < 90u) {
    return BTREE_DEFINITION_STATUS_STAND_BY;
  }
  btree_robot_data.charge_ticks = 0u;
  return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_robot_delivery_open_door(void)
{
  /* The door is stuck the first time; RetryUntilSuccessful tries it again. */
  btree_robot_data.door_attempts += 1u;
  printf("  open_door          attempt %u\n", (unsigned)btree_robot_data.door_attempts);
  return (btree_robot_data.door_attempts >= 2u) ? BTREE_DEFINITION_STATUS_SUCCESS
                                                : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_obstacle_detected(void)
{
  printf("  obstacle_detected? %s\n", btree_robot_data.obstacle_ahead ? "yes" : "no");
  return btree_robot_data.obstacle_ahead ? BTREE_DEFINITION_STATUS_SUCCESS
                                         : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_robot_delivery_deliver_package(void)
{
  btree_robot_data.delivered += 1u;
  btree_robot_data.battery_percent -= 25u;
  btree_robot_data.door_attempts = 0u;
  printf("  deliver_package    package #%u delivered\n", (unsigned)btree_robot_data.delivered);
  return BTREE_DEFINITION_STATUS_SUCCESS;
}
