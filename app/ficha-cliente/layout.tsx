import type {Metadata} from 'next';
export const metadata:Metadata={title:'Ficha segura | AUROX',robots:{index:false,follow:false,nocache:true},referrer:'no-referrer'};
export default function Layout({children}:{children:React.ReactNode}){
 return <><meta name="referrer" content="no-referrer"/>{children}</>;
}
