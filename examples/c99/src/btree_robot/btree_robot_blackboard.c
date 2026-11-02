/**
 * @file btree_robot_blackboard.c
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Blackboard interface.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#include "btree_robot_blackboard.h"

#include "string.h"

/**
 * @brief Tree structure with relevant blackboard data robot.
 *
 */
struct btree_robot_blackboard btree_robot_data = {
    .battery_percent = 15,
};

void btree_robot_reset_blackboard(void)
{
    memset(&btree_robot_data, 0, sizeof(btree_robot_data));
}
