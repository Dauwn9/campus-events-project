import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Афиша</h1>
      <Card className="space-y-3">
        <Badge>Тест UI-кита</Badge>
        <Input placeholder="Поле ввода" />
        <Button>Кнопка</Button>
      </Card>
      <EmptyState title="Событий пока нет" text="Заглушка пустого состояния" />
    </div>
  );
}