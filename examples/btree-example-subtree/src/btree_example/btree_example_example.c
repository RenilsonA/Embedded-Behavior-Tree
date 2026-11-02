/**
 * @file btree_example_example.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of example tree.
 * @version 1.0
 * @date 12/05/2025
 *
 */

#include "btree_example_example.h"

static int c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, c6 = 0, c7 = 0;
static int a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0, a6 = 0, a7 = 0, a8 = 0, a9 = 0,
           a10 = 0, a11 = 0;

btree_definition_status_t btree_example_example_condition1(void)
{
    SEGGER_RTT_printf(0, "c1 ");
    if (c1++ > 20)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action1(void)
{
    SEGGER_RTT_printf(0, "a1 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_condition2(void)
{
    SEGGER_RTT_printf(0, "c2 ");
    if (c2 != 0)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action2(void)
{
    SEGGER_RTT_printf(0, "a2 ");
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action3(void)
{
    SEGGER_RTT_printf(0, "a3 ");
    c2 = 1;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_condition4(void)
{
    SEGGER_RTT_printf(0, "c4 ");
    if (c4 != 0)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action4(void)
{
    SEGGER_RTT_printf(0, "a4 ");
    c4 = 1;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_condition5(void)
{
    SEGGER_RTT_printf(0, "c5 ");
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action5(void)
{
    SEGGER_RTT_printf(0, "a5 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_condition6(void)
{
    SEGGER_RTT_printf(0, "c6 ");
    if (c6 != 0)
        return BTREE_DEFINITION_STATUS_SUCCESS;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action6(void)
{
    SEGGER_RTT_printf(0, "a6 ");
    c6 = 1;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_example_example_action7(void)
{
    SEGGER_RTT_printf(0, "a7 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_actio8(void)
{
    SEGGER_RTT_printf(0, "a8 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_condition7(void)
{
    SEGGER_RTT_printf(0, "c7 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_action9(void)
{
    SEGGER_RTT_printf(0, "a9 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_action10(void)
{
    SEGGER_RTT_printf(0, "a10 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_example_example_action11(void)
{
    SEGGER_RTT_printf(0, "a11 ");
    return BTREE_DEFINITION_STATUS_SUCCESS;
}
