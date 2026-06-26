package com.lynnhub.app.data.remote.dto

import kotlinx.serialization.Serializable

// ============ Hermes Status ============
@Serializable
data class HermesStatusResponse(
    val installed: Boolean = false,
    val installVersion: String? = null,
    val installPath: String? = null,
    val config: HermesConfigDto? = null,
    val connected: Boolean = false,
    val version: String? = null,
    val capabilities: List<String> = emptyList(),
    val connectionError: String? = null
)

@Serializable
data class HermesConfigDto(
    val enabled: Boolean = false,
    val endpoint: String = "http://localhost:9119",
    val apiKey: String? = null,
    val autoStart: Boolean = false,
    val capabilities: List<String> = emptyList(),
    val status: String = "not_installed"
)

@Serializable
data class HermesInstallRequest(
    val action: String, // "install" | "start" | "stop"
    val port: Int? = null
)

@Serializable
data class HermesInstallResponse(
    val success: Boolean = false,
    val message: String = "",
    val pid: Long? = null
)

@Serializable
data class HermesTestRequest(
    val endpoint: String? = null,
    val apiKey: String? = null
)

@Serializable
data class HermesTestResponse(
    val connected: Boolean = false,
    val version: String? = null,
    val capabilities: List<String> = emptyList(),
    val error: String? = null
)

// ============ Hermes Execute ============
@Serializable
data class HermesExecuteRequest(
    val prompt: String,
    val mode: String = "auto", // "computer_use" | "shell" | "auto"
    val timeout: Int? = null,
    val workDir: String? = null
)

@Serializable
data class HermesExecuteResponse(
    val success: Boolean = false,
    val output: String = "",
    val steps: List<String>? = null,
    val screenshots: List<String>? = null,
    val durationMs: Long? = null,
    val error: String? = null
)

// ============ Hermes Skills ============
@Serializable
data class HermesSkillsResponse(
    val skills: List<HermesSkillDto> = emptyList(),
    val source: String = "hermes",
    val hermesRunning: Boolean = false
)

@Serializable
data class HermesSkillDto(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val category: String = "",
    val source: String = ""
)

@Serializable
data class HermesPreloadResponse(
    val success: Boolean = false,
    val count: Int = 0,
    val message: String = ""
)

// ============ Hermes Patterns ============
@Serializable
data class HermesPatternsResponse(
    val patterns: List<HermesPatternDto> = emptyList(),
    val pagination: PaginationDto? = null
)

@Serializable
data class HermesPatternDto(
    val id: String = "",
    val patternKey: String = "",
    val taskDescription: String = "",
    val taskTemplate: String? = null,
    val hermesPrompt: String? = null,
    val matchKeywords: List<String> = emptyList(),
    val executionCount: Int = 0,
    val autoExecutedCount: Int = 0,
    val autoExecute: Boolean = false,
    val createdAt: String = ""
)

@Serializable
data class HermesPatternPatchRequest(
    val autoExecute: Boolean? = null,
    val matchKeywords: List<String>? = null,
    val patternKey: String? = null
)

@Serializable
data class HermesPatternAutoCheckRequest(
    val taskDescription: String,
    val execute: Boolean = true
)

@Serializable
data class HermesPatternAutoCheckResponse(
    val matched: Boolean = false,
    val score: Double = 0.0,
    val patternId: String? = null,
    val executed: Boolean = false,
    val result: String? = null
)

// ============ Hermes Reports ============
@Serializable
data class HermesReportsResponse(
    val reports: List<HermesReportDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 20
)

@Serializable
data class HermesReportDto(
    val id: String = "",
    val type: String = "daily",
    val title: String = "",
    val content: String = "",
    val trigger: String = "manual",
    val pushChannel: String? = null,
    val createdAt: String = ""
)

@Serializable
data class HermesReportRequest(
    val type: String = "daily" // "daily" | "weekly" | "patrol"
)

@Serializable
data class HermesReportResponse(
    val success: Boolean = false,
    val reportId: String? = null,
    val title: String = "",
    val content: String = "",
    val pushed: Boolean = false,
    val durationMs: Long? = null
)

// ============ Hermes Memory ============
@Serializable
data class HermesMemorySearchResponse(
    val success: Boolean = false,
    val results: List<HermesMemoryItemDto> = emptyList()
)

@Serializable
data class HermesMemoryItemDto(
    val content: String = "",
    val score: Double = 0.0,
    val createdAt: String = ""
)

@Serializable
data class HermesProfileResponse(
    val success: Boolean = false,
    val profileDir: String = "",
    val memoryCount: Int = 0,
    val skillsCount: Int = 0,
    val sessionsCount: Int = 0,
    val exists: Boolean = false
)

// ============ Shared ============
@Serializable
data class PaginationDto(
    val page: Int = 1,
    val pageSize: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 0
)
