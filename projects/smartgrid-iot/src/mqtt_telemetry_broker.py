#!/usr/bin/env python3
"""
===============================================================================
SmartGrid IoT: Industrial MQTT Telemetry Broker Bridge & Topic Router
===============================================================================
Developer: Mohamed Seddik Feki <fekiseddik@gmail.com>
Academic Profile: Bachelor of Robotics and Automation Engineering (Honours)
Institution: Xiamen University Malaysia (XMUM)
License: MIT

Description:
High-reliability MQTT messaging and telemetry routing engine implementing:
1. MqttTopicRouter: Hierarchical topic matching with OASIS MQTT v3.1.1 / v5.0
   single-level (+) and multi-level (#) wildcards.
2. SmartGridMqttBridge: QoS 0/1/2 packet formatting and lifecycle state machine,
   retained message store, client session heartbeats, and Last Will &
   Testament (LWT) automated fail-safe alert publishing on timeout.
===============================================================================
"""

from collections import defaultdict
import json
import math
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


class MqttTopicRouter:
    """
    Robust MQTT Topic Router supporting single-level '+' and multi-level '#'
    wildcard subscription matching and payload dispatching.
    """

    def __init__(self) -> None:
        # Map: subscription_pattern -> list of callback callables
        self._subscriptions: Dict[str, List[Callable[[str, Any], Any]]] = defaultdict(list)

    @staticmethod
    def match_topic(subscription_pattern: str, published_topic: str) -> bool:
        """
        Evaluates whether a published topic matches a subscription pattern per MQTT spec.
        
        Rules:
        - '+' matches exactly one topic level.
        - '#' matches any number of trailing levels (must be the final segment).
        - Exact strings match verbatim.
        - Leading '$' topics (system topics) are reserved and do not match wildcards at root.
        """
        if not subscription_pattern or not published_topic:
            return False

        # Guard against system topic leakage with wildcards
        if published_topic.startswith("$") and not subscription_pattern.startswith("$"):
            return False

        if subscription_pattern == published_topic:
            return True

        if subscription_pattern == "#":
            return True

        sub_parts = subscription_pattern.split("/")
        pub_parts = published_topic.split("/")

        sub_len = len(sub_parts)
        pub_len = len(pub_parts)

        i = 0
        while i < sub_len:
            sub = sub_parts[i]
            if sub == "#":
                # '#' must be the last character in the pattern
                return i == sub_len - 1

            if i >= pub_len:
                return False

            pub = pub_parts[i]
            if sub != "+" and sub != pub:
                return False

            i += 1

        return i == pub_len

    def subscribe(self, pattern: str, callback: Callable[[str, Any], Any]) -> None:
        """Subscribes a callback to a topic pattern."""
        if not pattern or not callable(callback):
            return
        if callback not in self._subscriptions[pattern]:
            self._subscriptions[pattern].append(callback)

    def unsubscribe(self, pattern: str, callback: Optional[Callable[[str, Any], Any]] = None) -> bool:
        """Unsubscribes a callback from a pattern, or removes all callbacks for the pattern."""
        if pattern not in self._subscriptions:
            return False

        if callback is None:
            del self._subscriptions[pattern]
            return True

        if callback in self._subscriptions[pattern]:
            self._subscriptions[pattern].remove(callback)
            if not self._subscriptions[pattern]:
                del self._subscriptions[pattern]
            return True

        return False

    def dispatch(self, topic: str, payload: Any) -> List[Any]:
        """
        Dispatches a message on topic to all matching subscription patterns.
        Returns a list of results returned by invoked callbacks.
        """
        results = []
        for pattern, callbacks in list(self._subscriptions.items()):
            if self.match_topic(pattern, topic):
                for cb in callbacks:
                    try:
                        res = cb(topic, payload)
                        results.append(res)
                    except Exception as err:
                        results.append({"error": str(err), "pattern": pattern, "topic": topic})
        return results

    def get_subscriptions(self) -> List[str]:
        """Returns list of all active subscription patterns."""
        return list(self._subscriptions.keys())


class SmartGridMqttBridge:
    """
    Industrial SmartGrid MQTT Bridge handling QoS 0/1/2 packets,
    retained message store, client heartbeats, and Last Will & Testament (LWT)
    offline detection.
    """

    def __init__(self, broker_name: str = "SmartGrid-EdgeBroker-01") -> None:
        self.broker_name = broker_name
        self.router = MqttTopicRouter()

        # In-memory Retained Message Store: topic -> packet_dict
        self._retained_store: Dict[str, Dict[str, Any]] = {}

        # Client Sessions: client_id -> session_info
        self._clients: Dict[str, Dict[str, Any]] = {}

        # Packet counter for QoS 1 and 2 unique message IDs
        self._next_packet_id: int = 1

        # QoS 2 Handshake Tracking: packet_id -> status ('RECEIVED', 'RELEASED', 'COMPLETED')
        self._qos2_states: Dict[int, str] = {}

    def _generate_packet_id(self) -> int:
        pid = self._next_packet_id
        self._next_packet_id = (self._next_packet_id % 65535) + 1
        return pid

    def register_client(
        self,
        client_id: str,
        keep_alive: int = 60,
        will_topic: str = "",
        will_payload: str = "",
        will_qos: int = 0,
        will_retain: bool = False,
    ) -> Dict[str, Any]:
        """
        Registers or updates an IoT client session with optional Last Will & Testament.
        """
        if not client_id:
            raise ValueError("client_id cannot be empty")

        now = time.time()
        session = {
            "client_id": client_id,
            "keep_alive": max(5, int(keep_alive)),
            "last_seen": now,
            "online": True,
            "subscriptions": set(),
            "will": {
                "topic": will_topic,
                "payload": will_payload,
                "qos": will_qos if will_qos in (0, 1, 2) else 0,
                "retain": bool(will_retain),
            } if will_topic else None,
        }

        self._clients[client_id] = session
        return {
            "client_id": client_id,
            "status": "CONNECTED",
            "session_present": False,
            "timestamp": now,
        }

    def ping(self, client_id: str) -> bool:
        """Records a heartbeat / ping from a client."""
        if client_id in self._clients:
            self._clients[client_id]["last_seen"] = time.time()
            self._clients[client_id]["online"] = True
            return True
        return False

    def heartbeat(self, client_id: str) -> bool:
        """Alias for ping."""
        return self.ping(client_id)

    def subscribe(
        self,
        client_id: str,
        pattern: str,
        callback: Callable[[str, Any], Any],
    ) -> List[Dict[str, Any]]:
        """
        Subscribes a client to a topic pattern and immediately dispatches
        any matching retained messages.
        """
        if client_id not in self._clients:
            self.register_client(client_id)

        self._clients[client_id]["subscriptions"].add(pattern)
        self.router.subscribe(pattern, callback)

        # Check Retained Message Store for immediate delivery
        delivered_retained = []
        for topic, packet in self._retained_store.items():
            if MqttTopicRouter.match_topic(pattern, topic):
                try:
                    retained_packet = dict(packet)
                    retained_packet["retained_delivery"] = True
                    callback(topic, retained_packet)
                    delivered_retained.append(retained_packet)
                except Exception:
                    pass

        return delivered_retained

    def unsubscribe(self, client_id: str, pattern: str) -> bool:
        """Unsubscribes a client from a pattern."""
        if client_id in self._clients:
            self._clients[client_id]["subscriptions"].discard(pattern)
        return self.router.unsubscribe(pattern)

    def publish(
        self,
        topic: str,
        payload: Any,
        qos: int = 0,
        retain: bool = False,
        client_id: str = "",
    ) -> Dict[str, Any]:
        """
        Publishes a telemetry or control message through the broker bridge.
        
        :param topic: Target MQTT topic string
        :param payload: Data payload (string, dict, or numeric)
        :param qos: Quality of Service (0, 1, or 2)
        :param retain: If true, caches latest message for future subscribers
        :param client_id: Originating client identifier
        :return: Formatted MQTT packet dictionary
        """
        if not topic:
            raise ValueError("Topic cannot be empty")
        if "+" in topic or "#" in topic:
            raise ValueError("Publish topic cannot contain wildcards ('+' or '#')")

        valid_qos = qos if qos in (0, 1, 2) else 0
        now = time.time()
        packet_id = self._generate_packet_id() if valid_qos > 0 else 0

        # Serialize payload if necessary
        formatted_payload = payload
        if isinstance(payload, (dict, list)):
            try:
                formatted_payload = json.dumps(payload)
            except Exception:
                formatted_payload = str(payload)

        packet: Dict[str, Any] = {
            "topic": topic,
            "payload": formatted_payload,
            "qos": valid_qos,
            "retain": bool(retain),
            "timestamp": now,
            "packet_id": packet_id,
            "sender_client_id": client_id,
        }

        # Update Retained Store
        if retain:
            if formatted_payload == "" or formatted_payload is None:
                # MQTT spec: empty payload on retained topic clears the retained message
                self._retained_store.pop(topic, None)
            else:
                self._retained_store[topic] = packet

        # Track QoS 2 initial publish
        if valid_qos == 2:
            self._qos2_states[packet_id] = "RECEIVED"

        # Dispatch to active subscribers
        self.router.dispatch(topic, packet)

        return packet

    def acknowledge_qos1(self, packet_id: int) -> Dict[str, Any]:
        """Generates PUBACK response for QoS 1 delivery."""
        return {
            "type": "PUBACK",
            "packet_id": packet_id,
            "status": "ACKNOWLEDGED",
            "timestamp": time.time(),
        }

    def handle_qos2_handshake(self, stage: str, packet_id: int) -> Dict[str, Any]:
        """
        Executes 4-step QoS 2 handshake:
        PUBLISH -> PUBREC (Received) -> PUBREL (Released) -> PUBCOMP (Complete).
        """
        stage_upper = stage.upper()
        if stage_upper == "PUBREC":
            self._qos2_states[packet_id] = "RECEIVED"
            return {"type": "PUBREC", "packet_id": packet_id, "status": "RECEIVED"}
        elif stage_upper == "PUBREL":
            self._qos2_states[packet_id] = "RELEASED"
            return {"type": "PUBREL", "packet_id": packet_id, "status": "RELEASED"}
        elif stage_upper == "PUBCOMP":
            self._qos2_states[packet_id] = "COMPLETED"
            return {"type": "PUBCOMP", "packet_id": packet_id, "status": "COMPLETED"}
        else:
            raise ValueError(f"Unknown QoS 2 handshake stage: {stage}")

    def get_retained(self, topic: str) -> Optional[Dict[str, Any]]:
        """Retrieves retained message for a given topic."""
        return self._retained_store.get(topic)

    def check_timeouts(self, current_time: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Sweeps registered client sessions.
        If a client exceeds (1.5 * keep_alive) without a ping:
        - Marks client offline.
        - Automatically publishes its registered Last Will & Testament (LWT) message.
        """
        now = current_time if current_time is not None else time.time()
        lwt_published = []

        for cid, session in list(self._clients.items()):
            if not session["online"]:
                continue

            timeout_limit = session["keep_alive"] * 1.5
            if (now - session["last_seen"]) > timeout_limit:
                session["online"] = False
                will = session.get("will")
                if will and will.get("topic"):
                    # Publish Last Will & Testament alert
                    lwt_packet = self.publish(
                        topic=will["topic"],
                        payload=will["payload"],
                        qos=will["qos"],
                        retain=will["retain"],
                        client_id=f"LWT-{cid}",
                    )
                    lwt_published.append({
                        "client_id": cid,
                        "reason": "KEEP_ALIVE_TIMEOUT",
                        "lwt_packet": lwt_packet,
                    })

        return lwt_published

    def disconnect(self, client_id: str, graceful: bool = True) -> bool:
        """
        Handles client disconnect. If ungraceful, publishes LWT message immediately.
        """
        if client_id not in self._clients:
            return False

        session = self._clients[client_id]
        session["online"] = False

        if not graceful:
            will = session.get("will")
            if will and will.get("topic"):
                self.publish(
                    topic=will["topic"],
                    payload=will["payload"],
                    qos=will["qos"],
                    retain=will["retain"],
                    client_id=f"LWT-{client_id}",
                )

        return True
