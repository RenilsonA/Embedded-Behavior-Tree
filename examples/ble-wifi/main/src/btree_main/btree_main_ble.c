/**
 * @file btree_main_ble.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of ble tree.
 * @version 1.0
 * @date 10/05/2025
 *
 */

#include "btree_main_ble.h"

#include <stdio.h>
#include <string.h>

#include "esp_bt.h"
#include "esp_bt_defs.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_gatt_common_api.h"
#include "esp_gatts_api.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_netif_ip_addr.h"

#define GATTS_NUM_HANDLE 5

#define DEVICE_NAME "BTREE_DEVICE"

static const char *TAG                      = "BTREE_BLE";
static const uint16_t primary_service_uuid  = ESP_GATT_UUID_PRI_SERVICE;
static const uint16_t service_uuid          = 0x00FF;
static const uint16_t char_declaration_uuid = ESP_GATT_UUID_CHAR_DECLARE;
static const uint16_t char_ssid_uuid        = 0xFF01;
static const uint16_t char_pass_uuid        = 0xFF02;
static const uint8_t char_prop =
    ESP_GATT_CHAR_PROP_BIT_READ | ESP_GATT_CHAR_PROP_BIT_WRITE;
static uint16_t gatt_handle_table[GATTS_NUM_HANDLE];
static esp_gatt_if_t gatts_if = 0;
static uint16_t conn_id       = 0;
static bool is_connected      = false;

static esp_ble_adv_data_t adv_data = {
    .set_scan_rsp        = false,
    .include_name        = true,
    .include_txpower     = true,
    .min_interval        = 0x20,
    .max_interval        = 0x40,
    .appearance          = 0x00,
    .manufacturer_len    = 0,
    .p_manufacturer_data = NULL,
    .service_data_len    = 0,
    .p_service_data      = NULL,
    .service_uuid_len    = 0,
    .p_service_uuid      = NULL,
    .flag                = (ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT),
};

static esp_ble_adv_params_t adv_params = {
    .adv_int_min       = 0x20,
    .adv_int_max       = 0x40,
    .adv_type          = ADV_TYPE_IND,
    .own_addr_type     = BLE_ADDR_TYPE_PUBLIC,
    .channel_map       = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

static const esp_gatts_attr_db_t gatt_db[GATTS_NUM_HANDLE] = {
    // Primary Service
    [0] = {{ESP_GATT_AUTO_RSP},
           {ESP_UUID_LEN_16, (uint8_t *) &primary_service_uuid, ESP_GATT_PERM_READ,
            sizeof(uint16_t), sizeof(service_uuid), (uint8_t *) &service_uuid}},

    // SSID Characteristic Declaration
    [1] = {{ESP_GATT_AUTO_RSP},
           {ESP_UUID_LEN_16, (uint8_t *) &char_declaration_uuid, ESP_GATT_PERM_READ,
            sizeof(uint8_t), sizeof(uint8_t), (uint8_t *) &char_prop}},

    // SSID Characteristic Value
    [2] = {{ESP_GATT_AUTO_RSP},
           {ESP_UUID_LEN_16, (uint8_t *) &char_ssid_uuid, ESP_GATT_PERM_WRITE, 64, 0,
            NULL}},

    // Password Characteristic Declaration
    [3] = {{ESP_GATT_AUTO_RSP},
           {ESP_UUID_LEN_16, (uint8_t *) &char_declaration_uuid, ESP_GATT_PERM_READ,
            sizeof(uint8_t), sizeof(uint8_t), (uint8_t *) &char_prop}},

    // Password Characteristic Value
    [4] = {{ESP_GATT_AUTO_RSP},
           {ESP_UUID_LEN_16, (uint8_t *) &char_pass_uuid, ESP_GATT_PERM_WRITE, 64, 0,
            NULL}},
};


static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
    case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
        printf("Advertising data set complete, starting advertising...");
        esp_ble_gap_start_advertising(&adv_params);
        break;

    case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
        if (param->adv_start_cmpl.status != ESP_BT_STATUS_SUCCESS) {
            printf("Advertising start failed");
        } else {
            printf("Advertising started");
        }
        break;

    default:
        break;
    }
}

static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatt_if_param,
                                esp_ble_gatts_cb_param_t *param)
{
    switch (event) {
    case ESP_GATTS_REG_EVT: {
        printf("ESP_GATTS_REG_EVT");
        esp_ble_gap_set_device_name(DEVICE_NAME);
        esp_ble_gap_config_adv_data(&adv_data);

        esp_gatt_if_t gatt_if = gatt_if_param;
        esp_ble_gatts_create_attr_tab(gatt_db, gatt_if, GATTS_NUM_HANDLE, 0);
        break;
    }
    case ESP_GATTS_CONNECT_EVT:
        printf("Device connected");
        is_connected = true;
        gatts_if     = gatt_if_param;
        conn_id      = param->connect.conn_id;
        break;
    case ESP_GATTS_DISCONNECT_EVT:
        printf("Device disconnected");
        is_connected = false;
        esp_ble_gap_start_advertising(&adv_params);
        break;
    case ESP_GATTS_CREAT_ATTR_TAB_EVT: {
        if (param->add_attr_tab.status != ESP_GATT_OK) {
            printf("Create attribute table failed");
        } else {
            memcpy(gatt_handle_table, param->add_attr_tab.handles,
                   sizeof(gatt_handle_table));
            esp_ble_gatts_start_service(gatt_handle_table[0]);
        }
        break;
    }
    case ESP_GATTS_WRITE_EVT: {
        uint16_t handle          = param->write.handle;
        uint8_t *recv_buffer     = param->write.value;
        uint16_t recv_buffer_len = param->write.len;

        if (handle == gatt_handle_table[2]) {
            btree_main_blackboard_set_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_SSID,
                                             recv_buffer, recv_buffer_len);
            printf("SSID recebido: %.*s", recv_buffer_len, recv_buffer);
        } else if (handle == gatt_handle_table[4]) {
            btree_main_blackboard_set_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_PASSWORD,
                                             recv_buffer, recv_buffer_len);
            printf("Senha recebida: %.*s", recv_buffer_len, recv_buffer);
        } else {
            printf("Handle desconhecido na escrita: %d", handle);
        }

        break;
    }
    default:
        break;
    }
}

btree_definition_status_t btree_main_ble_have_credentials(void)
{
    uint8_t ssid[32]     = {0};
    uint8_t password[32] = {0};
    size_t ssid_size = 0, password_size = 0;

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_SSID, ssid,
                                     &ssid_size);
    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_PASSWORD, password,
                                     &password_size);

    if (ssid_size == 0 || password_size == 0) {
        printf("Credenciais ainda não recebidas.");
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_ble_bluetooth_has_started(void)
{
    return esp_bluedroid_get_status() == ESP_BLUEDROID_STATUS_ENABLED
               ? BTREE_DEFINITION_STATUS_SUCCESS
               : BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_main_ble_ble_deinit(void)
{
    esp_bluedroid_disable();
    esp_bluedroid_deinit();
    esp_bt_controller_disable();
    esp_bt_controller_deinit();
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_ble_ble_unregister(void)
{
    esp_ble_gatts_app_unregister(gatts_if);
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_ble_ble_disconnect(void)
{
    if (is_connected) {
        esp_ble_gatts_close(gatts_if, conn_id);
        is_connected = false;
        printf("BLE disconnected");
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_ble_ble_init(void)
{
    esp_err_t ret;

    printf("Initializing BLE");

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ret                               = esp_bt_controller_init(&bt_cfg);
    if (ret) {
        printf("Bluetooth controller initialize failed: %s", esp_err_to_name(ret));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    ret = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    if (ret) {
        printf("Bluetooth controller enable failed: %s", esp_err_to_name(ret));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    ret = esp_bluedroid_init();
    if (ret) {
        printf("Bluedroid stack init failed: %s", esp_err_to_name(ret));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    ret = esp_bluedroid_enable();
    if (ret) {
        printf("Bluedroid enable failed: %s", esp_err_to_name(ret));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_ble_ble_register(void)
{
    esp_err_t ret;

    printf("Registering BLE callbacks");

    ret = esp_ble_gatts_register_callback(gatts_event_handler);
    if (ret) {
        printf("gatts register error, error code = %x", ret);
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    ret = esp_ble_gap_register_callback(gap_event_handler);
    if (ret) {
        printf("gap register error, error code = %x", ret);
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    ret = esp_ble_gatts_app_register(0);
    if (ret) {
        printf("gatts app register error, error code = %x", ret);
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}