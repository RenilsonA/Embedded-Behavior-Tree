#ifndef MQTT_H_
#define MQTT_H_

#include "esp_netif_types.h"
#include "mqtt_client.h"
#include "sys/param.h"

/**
 * @brief Servidor usado para transferência de dados.
 */
#define MQTT_URI_SERVER "mqtt://test.mosquitto.org:1883"

/**
 * @brief Tópico onde os dados serão pegos.
 */
#define MQTT_TOPIC_SUBSCRIBE "/topic/btreetest/text"

/**
 * @brief Qualidade de serviço do servidor MQTT.
 */
#define MQTT_QOS 0

/**
 * @brief Função que inicia o cliente MQTT.
 *
 * @return esp_err_t 0 para sucesso, inteiro para falha.
 */
esp_err_t init_mqtt_client();

/**
 * @brief Função para reconectar e restabelecer conexão com o MQTT.
 *
 * @return esp_err_t 0 para sucesso, inteiro para falha.
 */
esp_err_t reconnect_mqtt_client();

/**
 * @brief Função para desconectar e pausar a conexão com o MQTT.
 *
 * @return esp_err_t 0 para sucesso, inteiro para falha.
 */
esp_err_t disconnect_mqtt_client();

/**
 * @brief Função para iniciar a aplicação do MQTT.
 *
 */
void mqtt_app_init();

#endif