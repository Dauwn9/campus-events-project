import Icon from "@/components/ui/Icon";
export default function Footer() {
  return <footer className="site-footer"><div className="page-container footer-inner"><div><a className="footer-brand" href="https://aiu.kz/?lang=ru" target="_blank" rel="noopener noreferrer">AIU <span>campus events</span></a><p>Место, где начинается твоя студенческая жизнь.</p></div><div className="footer-links"><a href="https://aiu.kz/life-at-aiu?lang=ru" target="_blank" rel="noopener noreferrer">Жизнь в AIU <Icon name="arrow" size={15} /></a><a href="https://aiu.kz/?lang=ru" target="_blank" rel="noopener noreferrer">aiu.kz <Icon name="arrow" size={15} /></a><span>Астана · Кампус AIU</span></div></div></footer>;
}
