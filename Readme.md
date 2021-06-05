### Запуск сервера

```
docker compose up
```

### Миграции

```
docker compose exec trackers-api npm run db:init
```

### Тесты

```
docker compose exec trackers-api npm run test
```
