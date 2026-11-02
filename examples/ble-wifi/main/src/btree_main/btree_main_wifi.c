/**
 * @file btree_main_wifi.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of wifi tree.
 * @version 1.0
 * @date 10/05/2025
 *
 */

#include "btree_main_wifi.h"

#include <stdio.h>
#include <string.h>

#include "app.h"
#include "esp_event.h"
#include "esp_netif_ip_addr.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "lwip/err.h"
#include "lwip/sys.h"
#include "nvs_flash.h"
#include "ping/ping_sock.h"

static struct btree_main_wifi {
    uint8_t retry_num;
} self = {
    .retry_num = 0,
};

static void wifi_event_handler(void *event_handler_arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data)
{
    if (event_id == WIFI_EVENT_STA_START) {
        printf("Conectando no WiFi");
    } else if (event_id == WIFI_EVENT_STA_CONNECTED) {
        printf("WiFi Conectado");
    } else if (event_id == WIFI_EVENT_STA_DISCONNECTED) {
        printf("WiFi Perdeu Conexao");
        btree_main_reset_blackboard();
        if (self.retry_num < 5) {
            esp_wifi_connect();
            self.retry_num++;
            printf("Tentando Conexao");
        }
    } else if (event_id == IP_EVENT_STA_GOT_IP) {
        printf("Wifi Pegou IP");
    }
}

static void ping_sucess(esp_ping_handle_t hdl, void *args)
{
    btree_main_blackboard_value_wifi_t is_connected =
        BTREE_MAIN_BLACKBOARD_VALUE_WIFI_CONNECTED;
    set_bool_tick();
    btree_main_blackboard_set_value(BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION,
                                    &is_connected);
}

static void ping_fail(esp_ping_handle_t hdl, void *args)
{
    btree_main_blackboard_value_wifi_t is_connected =
        BTREE_MAIN_BLACKBOARD_VALUE_WIFI_FAIL;
    set_bool_tick();
    btree_main_blackboard_set_value(BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION,
                                    &is_connected);
}

btree_definition_status_t btree_main_wifi_is_connected(void)
{
    btree_main_blackboard_value_wifi_t is_connected =
        BTREE_MAIN_BLACKBOARD_VALUE_WIFI_UNINITIALIZED;
    btree_main_blackboard_get_value(BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION,
                                    &is_connected);

    if (is_connected != BTREE_MAIN_BLACKBOARD_VALUE_WIFI_CONNECTED) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_is_fail(void)
{
    btree_main_blackboard_value_wifi_t is_connected =
        BTREE_MAIN_BLACKBOARD_VALUE_WIFI_UNINITIALIZED;
    btree_main_blackboard_get_value(BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION,
                                    &is_connected);

    if (is_connected == BTREE_MAIN_BLACKBOARD_VALUE_WIFI_FAIL) {
        return BTREE_DEFINITION_STATUS_SUCCESS;
    }

    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t btree_main_wifi_ping(void)
{
    ////////////////////////////// NEED THIS BECAUSE RETURN
    ///STAND_BY/////////////////////////
    btree_main_blackboard_value_wifi_t is_connected =
        BTREE_MAIN_BLACKBOARD_VALUE_WIFI_CONNECTED;
    btree_main_blackboard_get_value(BTREE_MAIN_BLACKBOARD_VALUE_ID_CONNECTION,
                                    &is_connected);
    if (is_connected) {
        return BTREE_DEFINITION_STATUS_SUCCESS;
    }
    ////////////////////////////// NEED THIS BECAUSE RETURN
    ///STAND_BY/////////////////////////

    esp_err_t err = ESP_OK;
    ip_addr_t ping_target;
    esp_netif_ip_info_t ip_info;
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");

    if (netif == NULL || esp_netif_get_ip_info(netif, &ip_info) != ESP_OK
        || ip_info.ip.addr == 0) {
        printf("Wi-Fi não está conectado. Ignorando ping.");
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    memset(&ping_target, 0, sizeof(ping_target));

    esp_ping_config_t ping_opt = ESP_PING_DEFAULT_CONFIG();
    ip4_addr_t destiny;

    destiny.addr           = ipaddr_addr("8.8.8.8");
    ping_target.u_addr.ip4 = destiny;

    ping_opt.target_addr = ping_target;
    ping_opt.count       = 3;
    ping_opt.interval_ms = 500;
    ping_opt.timeout_ms  = 5000;
    ping_opt.target_addr = ping_target;

    esp_ping_callbacks_t callbacks_opt = {
        .cb_args         = NULL,
        .on_ping_success = ping_sucess,
        .on_ping_timeout = ping_fail,
        .on_ping_end     = NULL,
    };

    esp_ping_handle_t ping;
    err = esp_ping_new_session(&ping_opt, &callbacks_opt, &ping);
    if (err) {
        printf("Erro de iniciar sessão de ping");
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    err = esp_ping_start(ping);
    if (err) {
        printf("Erro de iniciar o ping");
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_STAND_BY;
}

btree_definition_status_t btree_main_wifi_wifi_init(void)
{
    if (esp_netif_init()) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    if (esp_event_loop_create_default()) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    esp_netif_create_default_wifi_sta();

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_wifi_register(void)
{
    wifi_init_config_t config = WIFI_INIT_CONFIG_DEFAULT();

    if (esp_wifi_init(&config)) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL);

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_wifi_connect(void)
{
    uint32_t ssid_size     = 0;
    uint32_t password_size = 0;
    uint8_t ssid[32]       = {0};
    uint8_t password[32]   = {0};

    wifi_config_t wifi_configuration = {.sta = {
                                            .ssid     = "",
                                            .password = "",
                                        }};

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_SSID, ssid,
                                     &ssid_size);
    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_PASSWORD, password,
                                     &password_size);

    strcpy((char *) wifi_configuration.sta.ssid, (char *) ssid);
    strcpy((char *) wifi_configuration.sta.password, (char *) password);

    esp_wifi_set_config(ESP_IF_WIFI_STA, &wifi_configuration);

    esp_wifi_start();
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_connect();

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_clear_credentials(void)
{
    uint8_t buffer[32] = {0};
    btree_main_blackboard_set_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_SSID, buffer, 32);
    btree_main_blackboard_set_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_ID_PASSWORD, buffer,
                                     32);

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_wifi_disconnect(void)
{
    esp_err_t err;

    err = esp_wifi_disconnect();
    if (err != ESP_OK) {
        printf("Falha ao desconectar do Wi-Fi: %s", esp_err_to_name(err));
    }

    err = esp_wifi_stop();
    if (err != ESP_OK) {
        printf("Falha ao parar o Wi-Fi: %s", esp_err_to_name(err));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    self.retry_num = 0;

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_wifi_unregister(void)
{
    esp_err_t err1 =
        esp_event_handler_unregister(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler);
    esp_err_t err2 =
        esp_event_handler_unregister(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler);

    if (err1 != ESP_OK || err2 != ESP_OK) {
        printf("Falha ao remover handlers de evento");
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_wifi_wifi_deinit(void)
{
    esp_err_t err = esp_wifi_deinit();

    if (err != ESP_OK) {
        printf("Falha ao desinicializar Wi-Fi: %s", esp_err_to_name(err));
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}
