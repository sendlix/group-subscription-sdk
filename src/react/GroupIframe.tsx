import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

type Appearance = {
    primaryColor?: string;
    backgroundColor?: string;
    hoverColor?: string;
    textColor?: string;
    info?: string;
    name?: string;
};

interface Props extends React.IframeHTMLAttributes<HTMLIFrameElement> {
    id: string;
    appearance?: Appearance;
    startHeight?: number;
}

const GroupIframe = forwardRef<HTMLIFrameElement, Props>(
    function GroupIframe({ id, appearance, startHeight, ...rest }, forwardedRef) {
        const [height, setHeight] = useState(startHeight ?? 500);
        const internalRef = useRef<HTMLIFrameElement | null>(null);

        const setRef = (el: HTMLIFrameElement | null) => {
            internalRef.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) forwardedRef.current = el;
        };

        const queryParams = useMemo(() => {
            const params = new URLSearchParams();
            if (appearance) {
                if (appearance.primaryColor) params.append("primaryColor", appearance.primaryColor);
                if (appearance.backgroundColor) params.append("backgroundColor", appearance.backgroundColor);
                if (appearance.hoverColor) params.append("hoverColor", appearance.hoverColor);
                if (appearance.textColor) params.append("textColor", appearance.textColor);
                if (appearance.info) params.append("info", appearance.info);
                if (appearance.name) params.append("name", appearance.name);
            }
            return params.toString();
        }, [appearance]);

        useEffect(() => {
            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== "https://group.sendlix.com") return;
                const data = event.data as { type?: string; height?: number } | undefined;
                if (data?.type === "formResized" && typeof data.height === "number") {
                    setHeight(data.height);
                    if (internalRef.current) {
                        internalRef.current.style.height = `${data.height + 7}px`;
                    }
                }
            };
            window.addEventListener("message", handleMessage);
            return () => window.removeEventListener("message", handleMessage);
        }, []);

        return (
            <iframe
                {...rest}
                src={`https://group.sendlix.com/${id}?${queryParams}`}
                height={height}
                ref={setRef}
            />
        );
    },
);

GroupIframe.displayName = "GroupIframe";

export default GroupIframe;
