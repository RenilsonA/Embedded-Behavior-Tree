/**
 * @file btree_subtree_subtree.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of subtree tree.
 * @version 1.0
 * @date 12/05/2025
 *
 */

#include "btree_subtree_subtree.h"

static int c1 = 0, c2 = 0, c3 = 0;
static int a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0;

btree_definition_status_t btree_subtree_subtree_condition1(void)
{
    SEGGER_RTT_printf(0, "c1 ");
    if (c1++ > 2)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_action1(void)
{
    SEGGER_RTT_printf(0, "a1 ");
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_condition2(void)
{
    SEGGER_RTT_printf(0, "c2 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_subtree_subtree_action2(void)
{
    SEGGER_RTT_printf(0, "a2 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_subtree_subtree_condition3(void)
{
    SEGGER_RTT_printf(0, "c3 ");
    if (c3++ > 5)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_action3(void)
{
    SEGGER_RTT_printf(0, "a3 ");
    if (a3++ > 5)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_action4(void)
{
    SEGGER_RTT_printf(0, "a4 ");
    if (a4++ > 3)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_action5(void)
{
    SEGGER_RTT_printf(0, "a5 ");
    if (a5++ > 2)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_subtree_subtree_action6(void)
{
    SEGGER_RTT_printf(0, "a6 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}
