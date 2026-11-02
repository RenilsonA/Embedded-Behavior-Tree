#include "mqtt_btree.h"

#include "esp_err.h"

/**
 * @brief Manipulador de eventos registrado para receber eventos MQTT.
 * Esta função é chamada pelo loop de eventos do cliente MQTT.
 *
 * @param handler_args dados do usuário cadastrado no evento.
 * @param base base de eventos para o manipulador (sempre Base MQTT neste exemplo).
 * @param event_id o ID do evento recebido.
 * @param event_data os dados do evento, esp_mqtt_event_handle_t.
 */
static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data);

/**
 * @brief Estrutura com dados pertinentes do MQTT.
 */
static struct mqtt_config_t {
    esp_mqtt_client_handle_t client;   /**< Manipulador do cliente MQTT.*/
    esp_mqtt_client_config_t mqtt_cfg; /**< Configuração do MQTT.*/
} self = {
    .mqtt_cfg =
        {
            .broker.address.uri = MQTT_URI_SERVER,
        },
};

static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    esp_err_t err                   = ESP_OK;
    esp_mqtt_event_handle_t event   = event_data;
    esp_mqtt_client_handle_t client = event->client;
    int msg_id;
    switch ((esp_mqtt_event_id_t) event_id) {
    case MQTT_EVENT_CONNECTED:
        // self.mqtt_is_connected = true;
        break;
    case MQTT_EVENT_DISCONNECTED:
        // self.mqtt_is_connected = false;
        break;
    case MQTT_EVENT_SUBSCRIBED:
        break;
    case MQTT_EVENT_UNSUBSCRIBED:
        break;
    case MQTT_EVENT_PUBLISHED:
        break;
    case MQTT_EVENT_DATA:
        break;
    case MQTT_EVENT_ERROR:
        // self.mqtt_is_connected = false;
        break;
    default:
        break;
    }
}

esp_err_t init_mqtt_client()
{
    esp_err_t err = ESP_OK;
    err           = esp_mqtt_client_start(self.client);
    return err;
}

esp_err_t reconnect_mqtt_client()
{
    esp_err_t err = ESP_OK;
    err           = esp_mqtt_client_reconnect(self.client);
    return err;
}

esp_err_t disconnect_mqtt_client()
{
    esp_err_t err = ESP_OK;
    err           = esp_mqtt_client_disconnect(self.client);
    return err;
}

void mqtt_app_init()
{
    self.client = esp_mqtt_client_init(&self.mqtt_cfg);
    esp_mqtt_client_register_event(self.client, ESP_EVENT_ANY_ID, mqtt_event_handler,
                                   NULL);
}
