package com.lynnhub.app.di

import android.content.Context
import com.lynnhub.app.data.local.UserPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataStoreModule {

    @Provides
    @Singleton
    fun provideUserPreferences(
        @ApplicationContext context: Context
    ): UserPreferences = UserPreferences(context)
}
