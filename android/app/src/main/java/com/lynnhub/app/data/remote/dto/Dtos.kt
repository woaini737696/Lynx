package com.lynnhub.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============ Auth ============
@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: UserDto
)

@Serializable
data class UserDto(
    val id: String,
    val username: String,
    val displayName: String? = null,
    val role: String = "user"
)

// ============ Focus ============
@Serializable
data class FocusTaskDto(
    val id: String,
    val content: String,
    val completed: Boolean = false,
    val column: String? = null,
    val position: Int = 0
)

@Serializable
data class FocusResponse(
    val tasks: List<FocusTaskDto> = emptyList()
)

@Serializable
data class FocusPatchRequest(
    val completed: Boolean? = null
)

// ============ Task (看板) ============
@Serializable
data class TaskDto(
    val id: String,
    val content: String,
    val status: String = "active",
    val column: String = "task",
    val position: Int = 0,
    val completed: Boolean = false,
    val createdAt: String? = null,
    val idea: IdeaRefDto? = null
)

@Serializable
data class IdeaRefDto(
    val id: String,
    val content: String
)

@Serializable
data class TaskCreateRequest(
    val content: String,
    val column: String = "task",
    val ideaId: String? = null
)

@Serializable
data class TaskPatchRequest(
    val status: String? = null,
    val column: String? = null,
    val position: Int? = null,
    val content: String? = null
)

@Serializable
data class TaskStatsDto(
    val northstar: Int = 0,
    val campaign: Int = 0,
    val task: Int = 0,
    val done: Int = 0
)

// ============ Idea (灵感) ============
@Serializable
data class IdeaDto(
    val id: String,
    val content: String = "",
    val source: String = "lightning",
    val status: String = "inbox",
    val tags: List<String> = emptyList(),
    val attachments: List<AttachmentDto> = emptyList(),
    val createdAt: String = "",
    val success: Boolean? = null
)

@Serializable
data class AttachmentDto(
    val type: String = "image",
    val name: String = "",
    val url: String,
    val size: Long? = null
)

@Serializable
data class IdeaCreateRequest(
    val content: String,
    val source: String = "lightning",
    val status: String = "inbox",
    val attachments: List<AttachmentDto> = emptyList()
)

@Serializable
data class IdeaRequest(
    val content: String,
    val source: String = "lightning"
)

@Serializable
data class IdeaActionRequest(
    val action: String // board | abandon
)

@Serializable
data class IdeaDeleteRequest(
    val ids: List<String>
)

@Serializable
data class IdeasResponse(
    val ideas: List<IdeaDto> = emptyList()
)

// ============ Lark Task (飞书任务) ============
@Serializable
data class LarkTaskDto(
    val guid: String,
    val summary: String,
    val description: String? = null,
    val completed: Boolean = false,
    val dueAt: String? = null,
    val startAt: String? = null,
    val tasklistName: String? = null,
    val parentTaskGuid: String? = null,
    val assignees: List<AssigneeDto> = emptyList()
)

@Serializable
data class AssigneeDto(
    val name: String? = null,
    val displayName: String? = null
)

@Serializable
data class LarkTasksResponse(
    val tasks: List<LarkTaskDto> = emptyList(),
    val total: Int = 0
)

@Serializable
data class LarkTaskDetailResponse(
    val task: LarkTaskDto
)

@Serializable
data class LarkTaskToggleRequest(
    val complete: Boolean
)

@Serializable
data class SyncStateDto(
    val lastSyncAt: String? = null,
    val lastError: String? = null,
    val taskCount: Int = 0
)

@Serializable
data class SyncResponse(
    val success: Boolean,
    val state: SyncStateDto? = null
)

// ============ AI Chat ============
@Serializable
data class ChatSessionDto(
    val id: String,
    val title: String,
    val provider: String? = null,
    val model: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class ChatMessageDto(
    val id: String,
    val role: String, // user | assistant | system
    val content: String,
    val toolCalls: List<ToolCallDto>? = null,
    val createdAt: String? = null
)

@Serializable
data class ToolCallDto(
    val name: String,
    val arguments: String? = null,
    val result: String? = null
)

@Serializable
data class ChatMessageRequest(
    val role: String,
    val content: String
)

@Serializable
data class ChatSendRequest(
    val messages: List<ChatMessageRequest>,
    val provider: String = "deepseek",
    val model: String? = null,
    val assistantMode: Boolean = true,
    val stream: Boolean = false
)

@Serializable
data class ChatUsageDto(
    val prompt_tokens: Int = 0,
    val completion_tokens: Int = 0,
    val total_tokens: Int = 0
)

@Serializable
data class ChatToolCalledDto(
    val tool: String? = null,
    val args: Map<String, kotlinx.serialization.json.JsonElement>? = null,
    val result: kotlinx.serialization.json.JsonElement? = null
)

@Serializable
data class ChatResponse(
    val content: String = "",
    val provider: String? = null,
    val model: String? = null,
    val usage: ChatUsageDto? = null,
    val toolCalled: ChatToolCalledDto? = null
)

@Serializable
data class ChatSessionsResponse(
    val sessions: List<ChatSessionDto> = emptyList()
)

@Serializable
data class ChatMessagesResponse(
    val messages: List<ChatMessageDto> = emptyList()
)

@Serializable
data class ChatCreateSessionRequest(
    val title: String = "新对话",
    val provider: String = "deepseek"
)

@Serializable
data class AiModelDto(
    val provider: String,
    val models: List<String>
)

@Serializable
data class AiModelsResponse(
    val providers: List<AiModelDto> = emptyList()
)

// ============ AI Settings ============
@Serializable
data class AiSettingsDto(
    val assistantName: String = "Lynn",
    val assistantAvatar: String? = null,
    val avatarUrl: String? = null,
    val personaStyle: String = "friendly",
    val styleStrength: Int = 50,
    val distilledStyle: String? = null
)

// ============ Memory ============
@Serializable
data class MemoryNodeDto(
    val id: String,
    val type: String, // idea | conversation | cognition
    val content: String = "",
    val strength: Double = 0.0,
    val score: Double? = null,
    val createdAt: String = ""
)

@Serializable
data class MemoryResponse(
    val nodes: List<MemoryNodeDto> = emptyList()
)

@Serializable
data class MemorySearchResponse(
    val results: List<MemoryNodeDto> = emptyList()
)

// ============ Cognition ============
@Serializable
data class CognitionDto(
    val id: String,
    val type: String, // method | experience | prompt
    val content: String,
    val createdAt: String
)

@Serializable
data class CognitionsResponse(
    val cognitions: List<CognitionDto> = emptyList()
)

// ============ Common ============
@Serializable
data class SuccessResponse(
    val success: Boolean = true,
    val id: String? = null,
    val deleted: Int? = null,
    val error: String? = null
)

@Serializable
data class HealthResponse(
    val status: String = "ok",
    val version: String? = null,
    val timestamp: String? = null
)

@Serializable
data class MobileConfigResponse(
    val minVersion: String = "0.1.0",
    val latestVersion: String = "0.1.0",
    val maintenance: Boolean = false,
    val message: String? = null
)
