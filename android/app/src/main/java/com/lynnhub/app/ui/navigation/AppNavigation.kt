package com.lynnhub.app.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import com.lynnhub.app.ui.screen.board.BoardScreen
import com.lynnhub.app.ui.screen.chat.ChatScreen
import com.lynnhub.app.ui.screen.focus.FocusScreen
import com.lynnhub.app.ui.screen.inbox.InboxScreen
import com.lynnhub.app.ui.screen.memory.MemoryScreen
import com.lynnhub.app.ui.screen.settings.SettingsScreen
import com.lynnhub.app.ui.screen.tasks.TasksScreen
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500

@Composable
fun AppNavigation(
    navController: NavHostController,
    onLogout: () -> Unit
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.surface,
        bottomBar = { BottomNavBar(navController) }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = BottomTab.Focus.route,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(BottomTab.Focus.route) { FocusScreen() }
            composable(BottomTab.Board.route) { BoardScreen() }
            composable(BottomTab.Hermes.route) { com.lynnhub.app.ui.screen.hermes.HermesScreen() }
            composable(BottomTab.Tasks.route) { TasksScreen() }
            composable(BottomTab.Settings.route) {
                SettingsScreen(
                    onLogout = onLogout,
                    onNavigateToInbox = { navController.navigate("inbox") },
                    onNavigateToMemory = { navController.navigate("memory") }
                )
            }
            composable("inbox") { InboxScreen(onBack = { navController.popBackStack() }) }
            composable("memory") { MemoryScreen(onBack = { navController.popBackStack() }) }
        }
    }
}

@Composable
private fun BottomNavBar(navController: NavHostController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            bottomTabs.forEach { tab ->
                val isSelected = currentRoute == tab.route
                val isCenter = tab is BottomTab.Hermes

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                ) {
                    if (isCenter) {
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .offset(y = (-8).dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(Amber500, Orange500)
                                    )
                                )
                                .clickable { navigateTo(navController, tab.route) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = tab.selectedIcon,
                                contentDescription = tab.title,
                                tint = Color.White,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                        Text(
                            text = tab.title,
                            style = MaterialTheme.typography.labelMedium,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Amber500,
                            modifier = Modifier.offset(y = (-4).dp)
                        )
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { navigateTo(navController, tab.route) }
                                .padding(vertical = 8.dp, horizontal = 12.dp)
                        ) {
                            Icon(
                                imageVector = if (isSelected) tab.selectedIcon else tab.unselectedIcon,
                                contentDescription = tab.title,
                                tint = if (isSelected) Amber500
                                    else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = tab.title,
                                style = MaterialTheme.typography.labelMedium,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (isSelected) Amber500
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun navigateTo(navController: NavHostController, route: String) {
    navController.navigate(route) {
        popUpTo(navController.graph.findStartDestination().id) {
            saveState = true
        }
        launchSingleTop = true
        restoreState = true
    }
}
