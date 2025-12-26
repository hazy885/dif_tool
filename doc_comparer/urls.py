from django.urls import path
from . import views

urlpatterns = [
    path('compare/', views.compare_documents, name='compare'),
    path('', views.index, name='index')
]