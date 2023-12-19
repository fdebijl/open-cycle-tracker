import { modifier } from 'ember-modifier';

export default modifier(function childProximityScaler(element, [childSelector]: [string]) {
  const bindEvent = (event: Event) => {
    let clientX: number;
    let clientY: number;

    if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX as number;
      clientY = event.touches[0]?.clientY as number;
    } else if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const children: NodeListOf<HTMLDivElement> = element.querySelectorAll(childSelector);

    const minDimensions = 1;
    const maxDimensions = 4;

    children.forEach((child) => {
      const { left, top, width, height } = child.getBoundingClientRect();

      // Calculate the distance between the cursor and the child
      const xDistance = Math.max(clientX - (left + width / 2), (left + width / 2) - clientX);
      const yDistance = Math.max(clientY - (top + height / 2), (top + height / 2) - clientY);
      const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);

      // Calculate the scale factor based on the distance
      const scaleFactor = Math.min(1, Math.max(0, 1 - (distance / 50)));
      const widthScaleFactor = scaleFactor * (maxDimensions - minDimensions) + minDimensions;
      const heightScaleFactor = scaleFactor * (maxDimensions - minDimensions) + minDimensions;

      // Set the width and height of the child
      child.style.width = `${widthScaleFactor}em`;
      child.style.height = `${heightScaleFactor}em`;

      // Set the z-index of the child
      child.style.zIndex = `${Math.round(scaleFactor * 100)}`;

      // Replace the 0.5em margin with a margin that is half the width and height of the child
      child.style.marginLeft = child.style.marginLeft.replace(/ [0-9\.]+em\)/gi, ` ${widthScaleFactor / 2}em)`);
      child.style.marginTop = child.style.marginTop.replace(/ [0-9\.]+em\)/gi, ` ${heightScaleFactor / 2}em)`);

      // If the scale is above 1, add the class childPromixityScaler__scaled
      if (scaleFactor > 0.2) {
        child.classList.add('childProximityScaler__scaled');
      } else {
        child.classList.remove('childProximityScaler__scaled');
      }
    });
  }

  element.addEventListener('touchmove', bindEvent);
  element.addEventListener('mousemove', bindEvent);
});
