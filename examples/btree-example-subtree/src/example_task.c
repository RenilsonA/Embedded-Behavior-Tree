/*
 * example_task.c
 *
 *  Created on: 12 de mai. de 2025
 *      Author: Renilson
 */

#include "example_task.h"

#include "btree_example_array.h"
#include "btree_manager.h"
#include "os.h"

/**
 * @brief Prioridade da tarefa do power cut.
 *
 */
#define EXAMPLE_TASK_PRIO 10u

/**
 * @brief Tamanho da stack do power cut.
 *
 */
#define EXAMPLE_TASK_STACK_SIZE 1024

static btree_definition_status_t example_task_running_function(
    btree_definition_tree_data_t *struct_tree);

static btree_definition_status_t example_task_success_function(
    btree_definition_tree_data_t *struct_tree);

static btree_definition_status_t example_task_fail_function(
    btree_definition_tree_data_t *struct_tree);

static btree_definition_status_t example_task_standby_function(
    btree_definition_tree_data_t *struct_tree);

/**
 * @brief Estrutura de dados pertinentes do power cut.
 *
 */
static struct {
    OS_TCB tcb;                           /**< Estrutura de controle da task. */
    CPU_STK stk[EXAMPLE_TASK_STACK_SIZE]; /**< Stack da task. */
    bool need_tick;
    btree_definition_config_functions_t fuctions_tree;
} self = {
    .tcb       = {0},
    .stk       = {0},
    .need_tick = true,
    .fuctions_tree =
        {
            .function_tick = btree_manager_reactivity_tick_tree,
            .running_case  = example_task_running_function,
            .success_case  = example_task_success_function,
            .fail_case     = example_task_fail_function,
            .standby_case  = example_task_standby_function,
        },
};

void example_task_set_bool_tick(void)
{
    self.need_tick = true;
}

btree_definition_status_t example_task_running_function(
    btree_definition_tree_data_t *struct_tree)
{
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_RUNNING;
}

btree_definition_status_t example_task_success_function(
    btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "success\n");
    btree_manager_reset_tree(struct_tree);
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t example_task_fail_function(
    btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "fail\n");
    btree_manager_reset_tree(struct_tree);
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t example_task_standby_function(
    btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "standby\n");
    return BTREE_DEFINITION_STATUS_STAND_BY;
}

static void example_task(void)
{
    RTOS_ERR os_err;
    while (1) {
        if (self.need_tick) {
            self.need_tick = false;
            btree_manager_tick(&btree_example_control, &self.fuctions_tree);
            SEGGER_RTT_printf(0, "\n");
        }
        OSTimeDlyHMSM(0, 0, 0, 100, OS_OPT_TIME_HMSM_STRICT, &os_err);
    }
}

void example_task_init(void)
{
    RTOS_ERR os_err = {0};

    OSTaskCreate((OS_TCB *) &self.tcb, (CPU_CHAR *) "Example Task",
                 (OS_TASK_PTR) example_task, (void *) 0u, (OS_PRIO) EXAMPLE_TASK_PRIO,
                 (CPU_STK *) &self.stk[0u],
                 (CPU_STK_SIZE) (EXAMPLE_TASK_STACK_SIZE / 10u),
                 (CPU_STK_SIZE) EXAMPLE_TASK_STACK_SIZE, (OS_MSG_QTY) 0u, (OS_TICK) 0u,
                 (void *) 0u, (OS_OPT) (OS_OPT_TASK_STK_CHK | OS_OPT_TASK_STK_CLR),
                 (RTOS_ERR *) &os_err);
    APP_RTOS_ASSERT_DBG((RTOS_ERR_CODE_GET(os_err) == RTOS_ERR_NONE), 1);
}
