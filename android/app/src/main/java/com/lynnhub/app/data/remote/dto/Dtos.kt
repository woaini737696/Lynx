package com.lynnhub.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============ 通用响应包装 ============
@Serializable
data class ApiSuccessResponse<T>(
    val success: Boolean = true,
    val data: T? = null
)

@Serializable
data class ApiPaginatedResponse<T>(
    val success: Boolean = true,
    val data: List<T> = emptyList(),
    val total: Int = 0,
    val hasMore: Boolean = false,
    val cursor: String? = null
)

// ============ Auth ============
@Serializable
data class LoginRequest(
    val phone: String,
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
data class FocusItemDto(
    val id: String,
    val taskId: String,
    val position: Int = 0,
    val completed: Boolean = false,
    val task: FocusTaskDto
)

@Serializable
data class DailyFocusDto(
    val id: String,
    val date: String? = null,
    val cardIds: List<String> = emptyList(),
    val status: String = "pending",
    val items: List<FocusItemDto> = emptyList()
)

@Serializable
data class FocusResponse(
    val dailyFocus: DailyFocusDto? = null
)

@Serializable
data class FocusPatchRequest(
    val itemId: String,
    val completed: Boolean
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
data class TaskPatchResponse(
    val task: TaskDto,
    val success: Boolean = true,
    val cognitionExtracted: Boolean = false,
    val cognitionPending: Boolean = false
)

@Serializable
data class TaskStatsByColumnDto(
    val northstar: Int = 0,
    val campaign: Int = 0,
    val task: Int = 0
)

@Serializable
data class TaskStatsDto(
    val totalCompleted: Int = 0,
    val totalActive: Int = 0,
    val thisWeekCompleted: Int = 0,
    val byColumn: TaskStatsByColumnDto = TaskStatsByColumnDto()
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
data class IdeaIdDto(
    val id: String
)

@Serializable
data class IdeaCreateResponse(
    val success: Boolean = true,
    val data: IdeaIdDto? = null
)

@Serializable
data class IdeaDeletedDto(
    val deleted: Int = 0
)

@Serializable
data class IdeaDeleteResponse(
    val success: Boolean = true,
    val data: IdeaDeletedDto? = null
)

/** 灵感列表分页响应，等价于 ApiPaginatedResponse<IdeaDto> */
typealias IdeasPaginatedResponse = ApiPaginatedResponse<IdeaDto>

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
    val action: String // "complete" | "reopen"
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

// ============ Lark Task Create（创建飞书任务下发到成员） ============
@Serializable
data class LarkTaskCreateRequest(
    val summary: String,
    val assignees: List<String> = emptyList(),
    val due: String? = null,
    val description: String? = null,
    val tasklistGuid: String? = null
)

@Serializable
data class LarkTaskCreateResponse(
    val guid: String? = null,
    val url: String? = null,
    val summary: String? = null,
    val error: String? = null
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
data class ChatSessionCreateResponse(
    val session: ChatSessionDto
)

@Serializable
data class AiModelDto(
    val id: String = "",
    val name: String = "",
    val model: String = "",
    val available: Boolean = false
)

@Serializable
data class AiModelsResponse(
    val providers: List<AiModelDto> = emptyList(),
    @SerialName("default")
    val defaultProvider: String? = null,
    val catalog: kotlinx.serialization.json.JsonElement? = null
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

@Serializable
data class AiSettingsResponse(
    val settings: AiSettingsDto? = null
)

// ============ Memory ============
@Serializable
data class MemoryNodeDto(
    val id: String,
    val label: String = "",
    val type: String, // idea | conversation | cognition
    val color: String? = null,
    val strength: Double = 0.0,
    val connections: List<String> = emptyList(),
    val fullContent: String = "",
    val score: Double? = null,
    val createdAt: String = ""
)

@Serializable
data class MemoryResponse(
    val nodes: List<MemoryNodeDto> = emptyList()
)

@Serializable
data class MemorySearchItemDto(
    val id: String,
    val label: String = "",
    val source: String = "",
    val score: Double = 0.0,
    val type: String = ""
)

@Serializable
data class MemorySearchResponse(
    val results: List<MemorySearchItemDto> = emptyList(),
    val query: String = "",
    val limit: Int = 10,
    val offset: Int = 0,
    val total: Int = 0,
    val hasMore: Boolean = false
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

// ============ Token Analysis (词元分析) ============
@Serializable
data class TokenAnalysisRequest(
    val text: String,
    val model: String = "deepseek-chat"
)

@Serializable
data class TokenPieceDto(
    val text: String,
    val type: String, // cjk | latin | digit | punctuation | space | other
    val start: Int = 0,
    val end: Int = 0,
    val tokens: Int = 0
)

@Serializable
data class TokenStatsDto(
    val cjk: Int = 0,
    val latin: Int = 0,
    val digit: Int = 0,
    val punctuation: Int = 0,
    val space: Int = 0,
    val other: Int = 0
)

@Serializable
data class TokenEstimatedCostDto(
    val input: Double = 0.0,
    val currency: String = "CNY"
)

@Serializable
data class TokenAnalysisResponse(
    val tokenCount: Int = 0,
    val charCount: Int = 0,
    val charCountNoSpaces: Int = 0,
    val wordCount: Int = 0,
    val sentenceCount: Int = 0,
    val lineCount: Int = 0,
    val tokens: List<TokenPieceDto> = emptyList(),
    val stats: TokenStatsDto = TokenStatsDto(),
    val model: String = "deepseek-chat",
    val estimatedCost: TokenEstimatedCostDto = TokenEstimatedCostDto()
)

// ============ WS Gateway（在线设备 + 远程指令下发） ============
@Serializable
data class OnlineDeviceDto(
    val deviceId: String = "",
    val deviceName: String = "",
    val agentVersion: String = "",
    val capabilities: List<String> = emptyList(),
    val connectedAt: String? = null,
    val lastSeen: String? = null
)

@Serializable
data class OnlineDevicesResponse(
    val devices: List<OnlineDeviceDto> = emptyList(),
    val total: Int = 0
)

@Serializable
data class DispatchRequest(
    val userId: String,
    val command: String,
    val targetDeviceId: String? = null
)

@Serializable
data class DispatchResponse(
    val dispatched: Boolean = false,
    val commandId: String? = null,
    val reason: String? = null
)
